const webpush = require('web-push');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('\n=== 새로운 VAPID 웹 푸시 알림 키 세트 ===\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:admin@dormichan.com`);
console.log('\n=========================================\n');
