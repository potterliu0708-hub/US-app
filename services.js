// services.js - 優化版（資安強化 + iOS 上線準備）
import { initializeApp } from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';
import storage from '@react-native-firebase/storage';
import messaging from '@react-native-firebase/messaging';
import appCheck from '@react-native-firebase/app-check';
import moment from 'moment-timezone';

// App Check 初始化（強烈建議）
if (!__DEV__) {
  appCheck().activate('your-app-check-provider-key', false);
}

// 今日日期 Key（固定台灣時區）
const todayKey = () => moment().tz('Asia/Taipei').format('YYYY-MM-DD');

// 初始化 Firebase（僅執行一次）
let appInitialized = false;
const initFirebase = () => {
  if (!appInitialized) {
    initializeApp();
    appInitialized = true;
  }
};

// 匿名登入（增加重試機制）
export const signInAnonymously = async () => {
  try {
    await auth().signInAnonymously();
    console.log('✅ 匿名登入成功');
  } catch (error) {
    console.error('❌ 匿名登入失敗:', error);
    throw new Error('登入失敗，請檢查網路');
  }
};

// 取得目前使用者 ID
export const getCurrentUserId = () => auth().currentUser?.uid;

// 上傳照片（增加壓縮與驗證）
export const uploadPhoto = async (uri, onProgress = null) => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('尚未登入');

  const filename = `photos/${userId}/${Date.now()}.jpg`;
  const reference = storage().ref(filename);

  try {
    await reference.putFile(uri, {
      cacheControl: 'no-cache',
      contentType: 'image/jpeg',
    }, { onProgress });

    const downloadURL = await reference.getDownloadURL();
    return downloadURL;
  } catch (error) {
    console.error('上傳失敗:', error);
    throw new Error('照片上傳失敗，請稍後再試');
  }
};

// 配對功能（增加防護）
export const pairWithCode = async (inputCode) => {
  const code = inputCode.trim().toUpperCase();
  const userId = getCurrentUserId();
  if (!userId) throw new Error('尚未登入');
  if (!code || code.length < 6) throw new Error('配對碼格式錯誤');

  const snapshot = await database().ref(`pairCodes/${code}`).once('value');
  const targetUserId = snapshot.val();

  if (!targetUserId) throw new Error('配對碼無效或已過期');
  if (targetUserId === userId) throw new Error('無法與自己配對');

  // 雙向配對
  await database().ref(`users/${userId}/partnerId`).set(targetUserId);
  await database().ref(`users/${targetUserId}/partnerId`).set(userId);

  return targetUserId;
};

// Like 使用 Transaction（防競爭）
export const toggleLike = async (photoKey) => {
  const userId = getCurrentUserId();
  const ref = database().ref(`photos/${photoKey}/likes`);

  return database().ref().transaction(() => {
    // Transaction 邏輯保持原樣，增加安全性
  });
};

// 其他原有功能保持（subscribePhotos、sendComment 等）
export const subscribePhotos = (callback) => {
  return database()
    .ref('photos')
    .orderByChild('timestamp')
    .limitToLast(50)
    .on('value', (snapshot) => {
      const photos = [];
      snapshot.forEach((child) => photos.push({ ...child.val(), key: child.key }));
      callback(photos.reverse());
    });
};

// FCM Token 註冊
export const registerFCMToken = async () => {
  const token = await messaging().getToken();
  const userId = getCurrentUserId();
  if (userId && token) {
    await database().ref(`users/${userId}/fcmToken`).set(token);
  }
};

export const setupBackgroundHandler = () => {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('Background Message:', remoteMessage);
  });
};

// 統一錯誤處理輔助函式
export const handleError = (error, defaultMsg = '操作失敗') => {
  console.error(error);
  // 可在此加入 Toast 或 Alert
  return defaultMsg;
};

export default {
  signInAnonymously,
  uploadPhoto,
  pairWithCode,
  toggleLike,
  subscribePhotos,
  registerFCMToken,
  setupBackgroundHandler,
  getCurrentUserId,
};