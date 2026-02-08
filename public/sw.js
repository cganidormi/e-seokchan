// Install event - force new service worker to activate immediately causes the PWA to update
// VERSION: 2026-02-08-v4 (Robust Notification Click)
self.addEventListener('install', function (event) {
    console.log('[SW] Installing new version...');
    self.skipWaiting();
});

// Activate event - take control of all open clients immediately
self.addEventListener('activate', function (event) {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function (event) {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/icon-v3-192.png', // Use updated icon
            badge: '/icon-v3-192.png',
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: '2',
                url: data.url || '/'
            }
        };
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(function (clientList) {
            const url = event.notification.data.url;

            // Check if there's already a tab open with this URL
            // Or just any tab of our app
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                // Check if client url matches our app origin
                if (client.url.includes(self.registration.scope) && 'focus' in client) {
                    if ('navigate' in client) {
                        client.navigate(url);
                    }
                    return client.focus();
                }
            }
            // If not open, open new window
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});

// PWA 설치 조건 충족을 위한 기본 fetch 핸들러
self.addEventListener('fetch', function (event) {
    // 기본적으로 네트워크 요청을 그대로 통과시킴
    // 필요 시 여기에 캐싱 로직 추가 가능
    event.respondWith(fetch(event.request));
});
