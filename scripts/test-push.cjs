// One-shot: send a real FCM push to a device token via firebase-admin.
// Validates FIREBASE_CREDENTIALS + the device's registered token end-to-end.
const admin = require('../apps/backend/node_modules/firebase-admin');

// Service account from Firebase Console (general-b14cb). Gitignored.
const creds = require('./.fb-sa.json');

const TOKEN = process.argv[2];
if (!TOKEN) { console.error('usage: node test-push.cjs <fcm-token>'); process.exit(1); }

admin.initializeApp({ credential: admin.credential.cert(creds) });

admin.messaging().send({
  token: TOKEN,
  notification: {
    title: 'Monitor B',
    body: 'push test ' + new Date().toISOString().slice(11, 19),
  },
  data: { type: 'message', conversationId: 'fd37b18b-3d2d-4ee4-9661-c7612b051ba9' },
  android: { priority: 'high' },
}).then((id) => {
  console.log('FCM send OK, messageId:', id);
  process.exit(0);
}).catch((e) => {
  console.error('FCM send FAILED:', e.code, e.message);
  process.exit(1);
});
