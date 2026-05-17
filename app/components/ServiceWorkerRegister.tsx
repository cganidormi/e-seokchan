'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/sw.js')
                .then((registration) => {
                    console.log('SW Registered');

                    // Check for updates every time the page loads
                    registration.update();

                    // If a waiting worker exists, let it take over
                    if (registration.waiting) {
                        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                    }
                })
                .catch((error) => {
                    console.error('SW Register fail:', error);
                });

            // Refresh page only when a NEW SW takes control over an EXISTING controlled page (updates app)
            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing && navigator.serviceWorker.controller) {
                    refreshing = true;
                    window.location.reload();
                }
            });
        }
    }, []);

    return null;
}
