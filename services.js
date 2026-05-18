// services.js — Firebase · Pairing · Notifications
// ─────────────────────────────────────────────────────────────────────────────
import database  from '@react-native-firebase/database';
import storage   from '@react-native-firebase/storage';
import auth      from '@react-native-firebase/auth';
import messaging from '@react-native-firebase/messaging';
import notifee, { IOSAuthorizationStatus } from '@notifee/react-native';

const db  = () => database();
const ref = path => db().ref(path);
const uid = () => auth().currentUser?.uid;

// ══ AUTH ════════════════════════════════════════════════════════════════════
export const signInAnonymously  = () => auth().signInAnonymously();
export const onAuthStateChanged = cb => auth().onAuthStateChanged(cb);

// ══ UTILS ═══════════════════════════════════════════════════════════════════
// Fix 1: moment-timezone — both users produce the same dayKey regardless of
// device timezone. Change TZ if your user base is outside Asia/Taipei.
import moment from 'moment-timezone';
const TZ = 'Asia/Taipei';

export const todayKey = () => moment().tz(TZ).format('YYYY-MM-DD');
export const nowTime  = () => moment().tz(TZ).format('HH:mm');

const DAYS_ZH = ['週日','週一','週二','週三','週四','週五','週六'];
export const dayKeyToLabel = key => {
  const today = todayKey();
  const yest  = new Date(new Date().setDate(new Date().getDate()-1)).toISOString().slice(0,10);
  if (key === today) return '今天';
  if (key === yest)  return '昨天';
  const d = new Date(key);
  return `${DAYS_ZH[d.getDay()]} ${key.slice(5).replace('-','月')}日`;
};

// ══ PHOTOS ══════════════════════════════════════════════════════════════════
// /photos/{YYYY-MM-DD}/{photoId}: { url, sender, time, liked, comments/{id} }

export const subscribePhotos = cb => {
  const r = ref('photos');
  const h = r.on('value', snap => {
    const raw = snap.val() || {};
    const days = Object.entries(raw)
      .map(([key, obj]) => ({
        key,
        label:  dayKeyToLabel(key),
        photos: Object.entries(obj || {})
          .map(([id, p]) => ({ id, ...p, comments: Object.values(p.comments||{}).sort((a,b)=>a.ts-b.ts) }))
          .sort((a,b) => a.time.localeCompare(b.time)),
      }))
      .sort((a,b) => b.key.localeCompare(a.key));
    cb(days);
  });
  return () => r.off('value', h);
};

// Atomic like toggle — Transaction prevents race conditions
export const toggleLike = async (dayKey, photoId) => {
  const { committed, snapshot } = await ref(`photos/${dayKey}/${photoId}`).transaction(cur => {
    if (!cur) return cur;
    return { ...cur, liked: !cur.liked };
  });
  if (!committed) throw new Error('toggleLike: not committed');
  return snapshot.val();
};

export const addComment = async (dayKey, photoId, text, senderName) => {
  const r = ref(`photos/${dayKey}/${photoId}/comments`).push();
  await r.set({ id:r.key, name:senderName, text:text.trim(), uid:uid(), ts:Date.now() });
};

// Image spec: 1080px max dimension, JPEG, ~0.92 quality (~200–400KB typical)
const STORAGE_META = { contentType: 'image/jpeg' };

export const uploadPhoto = async (localUri, sender) => {
  const dayKey  = todayKey();
  const photoId = ref('photos').push().key;
  const path    = `photos/${dayKey}/${photoId}.jpg`;
  await storage().ref(path).putFile(localUri, STORAGE_META);
  const url = await storage().ref(path).getDownloadURL();
  await ref(`photos/${dayKey}/${photoId}`).set({ url, sender, time:nowTime(), uid:uid(), liked:false, comments:{} });
  return { dayKey, photoId };
};

// ══ PAIRING ═════════════════════════════════════════════════════════════════
// /pairingCodes/{code}: { uid, createdAt }
// /users/{uid}: { displayName, pairingCode, partnerId?, fcmToken? }

// Fix 2: unambiguous charset — excludes 0/O, 1/I/L to prevent user input errors
const CHARS      = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const randomCode = () =>
  Array.from({ length:6 }, () => CHARS[Math.floor(Math.random()*CHARS.length)]).join('');

export const initMyCode = async (displayName = '我') => {
  const myUid = uid();
  const snap  = await ref(`users/${myUid}`).once('value');
  if (snap.val()?.pairingCode) return snap.val().pairingCode;
  let code, exists = true;
  while (exists) {
    code   = randomCode();
    exists = (await ref(`pairingCodes/${code}`).once('value')).exists();
  }
  await Promise.all([
    ref(`users/${myUid}`).update({ displayName, pairingCode:code }),
  ]);
  return code;
};

export const pairWithCode = async code => {
  const myUid    = uid();
  const codeSnap = await ref(`pairingCodes/${code.toUpperCase()}`).once('value');
  if (!codeSnap.exists())                   throw new Error('配對碼不存在');
  const { uid: partnerUid } = codeSnap.val();
  if (partnerUid === myUid)                  throw new Error('不能使用自己的配對碼');
  const pSnap = await ref(`users/${partnerUid}`).once('value');
  if (pSnap.val()?.partnerId)                throw new Error('對方已與其他人配對');
  await Promise.all([
    ref(`users/${myUid}`).update({ partnerId:partnerUid }),
    ref(`users/${partnerUid}`).update({ partnerId:myUid }),
  ]);
  return { partnerUid, partnerName: pSnap.val()?.displayName || 'Baby' };
};

export const unpair = async () => {
  const myUid = uid();
  const pid   = (await ref(`users/${myUid}/partnerId`).once('value')).val();
  const upd   = { [`users/${myUid}/partnerId`]: null };
  if (pid) upd[`users/${pid}/partnerId`] = null;
  await db().ref().update(upd);
};

export const subscribeMyUser = cb => {
  const r = ref(`users/${uid()}`);
  const h = r.on('value', snap => cb(snap.val() || {}));
  return () => r.off('value', h);
};

export const fetchPartnerName = async partnerUid =>
  (await ref(`users/${partnerUid}/displayName`).once('value')).val() || 'Baby';

// ══ NOTIFICATIONS ═══════════════════════════════════════════════════════════
export const requestPermission = async () => {
  const s = await notifee.requestPermission({ sound:true, badge:true, alert:true });
  return s.authorizationStatus >= IOSAuthorizationStatus.AUTHORIZED;
};

export const registerDevice = async () => {
  if (!(await requestPermission())) return null;
  await messaging().registerDeviceForRemoteMessages();
  const token = await messaging().getToken();
  await db().ref(`users/${uid()}/fcmToken`).set(token);
  messaging().onTokenRefresh(t => db().ref(`users/${uid()}/fcmToken`).set(t));
  return token;
};

export const listenForegroundMessages = () =>
  messaging().onMessage(async msg => {
    const { title, body } = msg.notification ?? {};
    await notifee.displayNotification({
      title: title ?? 'us', body: body ?? '',
      ios: { sound:'default', badgeCount:1, threadId:'us-thread',
             foregroundPresentationOptions:{ alert:true, badge:true, sound:true } },
    });
  });

// Call at module level in App.js (before any component mounts)
export const setupBackgroundHandler = () => {
  messaging().setBackgroundMessageHandler(async () => {});
  notifee.onBackgroundEvent(async () => {});
};

export const clearBadge = () => notifee.setBadgeCount(0);
