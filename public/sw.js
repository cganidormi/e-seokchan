// Install event - force new service worker to activate immediately causes the PWA to update
// VERSION: 2026-10-20-v6 (Dongheon Chat: suppress push while chat is open)
self.addEventListener('install', function (event) {
    console.log('[SW] Installing new version (v5)...');
    self.skipWaiting();
});

// Activate event - take control of all open clients immediately
self.addEventListener('activate', function (event) {
    event.waitUntil(self.clients.claim());
});

// 동헌톡 대화창이 열려 있는 클라이언트(탭) ID 목록
const dongheonChatOpenClients = new Set();

self.addEventListener('message', function (event) {
    const msg = event.data;
    if (!msg || msg.type !== 'DONGHEON_CHAT_STATE' || !event.source) return;
    if (msg.open) {
        dongheonChatOpenClients.add(event.source.id);
    } else {
        dongheonChatOpenClients.delete(event.source.id);
    }
});

// 동헌톡 창이 열린 채로 화면에 보이고 있는지 확인
async function isDongheonChatVisible() {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    
    // 1) 메모리 Set에 있고 현재 화면이 보이는 경우
    const hasInSet = clientList.some(function (c) {
        return dongheonChatOpenClients.has(c.id) && c.visibilityState === 'visible';
    });
    if (hasInSet) return true;

    // 2) SW 재시작 등으로 Set이 비었을 수 있으므로 화면이 켜져 있는 창에 직접 상태 질의 (Ping)
    const visibleClients = clientList.filter(function (c) {
        return c.visibilityState === 'visible';
    });
    if (visibleClients.length === 0) return false;

    try {
        const pingPromises = visibleClients.map(function (client) {
            return new Promise(function (resolve) {
                const messageChannel = new MessageChannel();
                messageChannel.port1.onmessage = function (event) {
                    if (event.data && event.data.isDongheonChatOpen) {
                        dongheonChatOpenClients.add(client.id);
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                };
                client.postMessage({ type: 'PING_DONGHEON_CHAT' }, [messageChannel.port2]);
                setTimeout(function () { resolve(false); }, 300);
            });
        });
        const results = await Promise.all(pingPromises);
        return results.some(Boolean);
    } catch (e) {
        return false;
    }
}

self.addEventListener('push', function (event) {
    if (event.data) {
        const data = event.data.json();

        // Update App Icon Badge if supported
        if (data.badge !== undefined && self.navigator && self.navigator.setAppBadge) {
            self.navigator.setAppBadge(data.badge).catch(err => console.error('SW Badge Error:', err));
        }

        const options = {
            body: data.body,
            icon: '/icon-v3-192.png', // Use updated icon
            badge: '/icon-v3-192.png', // Android status bar badge icon
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: '2',
                url: data.url || '/'
            }
        };

        if (data.tag === 'dongheon-chat') {
            options.tag = 'dongheon-chat';
            options.renotify = true;
            event.waitUntil(
                isDongheonChatVisible().then(function (visible) {
                    // 대화 중(대화창이 열려 화면에 보이는 중)이면 알림 생략
                    if (visible) return;
                    return self.registration.showNotification(data.title, options);
                })
            );
            return;
        }

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
