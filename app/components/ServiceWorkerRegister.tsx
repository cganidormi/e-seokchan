'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/sw.js')
                .then((registration) => {
                    console.log('SW Registered');

                    // Check for updates in the background
                    registration.update().catch(() => { });

                    // If a waiting worker exists, let it take over
                    if (registration.waiting) {
                        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                    }
                })
                .catch((error) => {
                    console.error('SW Register fail:', error);
                });
        }
    }, []);

    return null;
}
