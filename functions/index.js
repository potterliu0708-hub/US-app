// functions/index.js — Firebase Cloud Functions
// ─────────────────────────────────────────────────────────────────────────────
// Deploy: firebase deploy --only functions
//
// Fix 3: Cloud Function that triggers on /photos/{dayKey}/{photoId} writes,
// reads the partner's fcmToken from /users/{uid}/partnerId → /users/{partnerId}/fcmToken,
// then sends a push notification via Firebase Admin SDK.
// ─────────────────────────────────────────────────────────────────────────────

const { onValueWritten } = require('firebase-functions/v2/database');
const { initializeApp }  = require('firebase-admin/app');
const { getDatabase }    = require('firebase-admin/database');
const { getMessaging }   = require('firebase-admin/messaging');

initializeApp();

const db  = () => getDatabase();
const ref = path => db().ref(path);

// ── sendToPartner helper ──────────────────────────────────────────────────────
async function sendToPartner(senderUid, title, body, data = {}) {
  // 1. look up sender's partnerId
  const partnerSnap = await ref(`users/${senderUid}/partnerId`).once('value');
  const partnerId   = partnerSnap.val();
  if (!partnerId) return;           // not paired — nothing to do

  // 2. look up partner's fcmToken
  const tokenSnap = await ref(`users/${partnerId}/fcmToken`).once('value');
  const token     = tokenSnap.val();
  if (!token) return;               // partner has no token (permissions denied)

  // 3. send via FCM
  await getMessaging().send({
    token,
    notification: { title, body },
    data:         { ...data, click_action:'FLUTTER_NOTIFICATION_CLICK' },
    apns: {
      payload: { aps: { sound:'default', badge:1 } },
    },
  });
}

// ── sendDirect: notify a specific uid directly (not via partner lookup) ─────
async function sendDirect(targetUid, title, body, data = {}) {
  const tokenSnap = await ref(`users/${targetUid}/fcmToken`).once('value');
  const token     = tokenSnap.val();
  if (!token) return;
  await getMessaging().send({
    token,
    notification: { title, body },
    data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
    apns: { payload: { aps: { sound: 'default', badge: 1 } } },
  });
}

// ── Trigger: photo liked ──────────────────────────────────────────────────────
// Notify the photo OWNER when their partner likes the photo.
// We read photo.uid (the uploader) and notify them directly —
// NOT via sendToPartner, which would wrongly notify the liker's partner instead.
exports.onPhotoLiked = onValueWritten(
  { ref: '/photos/{dayKey}/{photoId}', region: 'asia-east1' },
  async event => {
    const before = event.data.before.val();
    const after  = event.data.after.val();

    // Only act when liked just flipped to true
    if (!after?.liked || before?.liked === true) return;

    const ownerUid = after.uid;    // uid of the person who uploaded the photo
    if (!ownerUid) return;

    // Don't notify if the owner liked their own photo
    // (shouldn't happen in a 2-person app, but defensive)
    // We can't easily know the liker's uid here without extra DB reads,
    // so we just send — the owner will appreciate knowing their photo was liked.
    await sendDirect(
      ownerUid,
      'us♥',
      '對方喜歡了你的照片 ❤️',
      { type: 'LIKE', dayKey: event.params.dayKey, photoId: event.params.photoId }
    );
  }
);

// ── Trigger: new comment posted ───────────────────────────────────────────────
exports.onCommentAdded = onValueWritten(
  { ref:'/photos/{dayKey}/{photoId}/comments/{commentId}', region:'asia-east1' },
  async event => {
    // Only fire on create (before is null)
    if (event.data.before.exists()) return;

    const comment   = event.data.after.val();
    const authorUid = comment?.uid;
    if (!authorUid) return;

    await sendToPartner(
      authorUid,
      'us♥',
      `${comment.name}: ${comment.text}`,
      { type:'COMMENT', dayKey: event.params.dayKey, photoId: event.params.photoId }
    );
  }
);

// ── Trigger: new photo uploaded ───────────────────────────────────────────────
exports.onPhotoUploaded = onValueWritten(
  { ref:'/photos/{dayKey}/{photoId}', region:'asia-east1' },
  async event => {
    // Only fire on create
    if (event.data.before.exists()) return;

    const photo     = event.data.after.val();
    const uploaderUid = photo?.uid;
    if (!uploaderUid) return;

    await sendToPartner(
      uploaderUid,
      'us♥',
      `${photo.sender} 分享了一張新照片 📸`,
      { type:'PHOTO', dayKey: event.params.dayKey, photoId: event.params.photoId }
    );
  }
);
