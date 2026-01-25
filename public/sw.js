self.addEventListener('push', function (event) {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
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
        clients.openWindow(event.notification.data.url)
    );
});

// PWA 설치 조건 충족을 위한 기본 fetch 핸들러
self.addEventListener('fetch', function (event) {
    // 기본적으로 네트워크 요청을 그대로 통과시킴
    // 필요 시 여기에 캐싱 로직 추가 가능
    event.respondWith(fetch(event.request));
});
