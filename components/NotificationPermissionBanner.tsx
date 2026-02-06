'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import toast from 'react-hot-toast';

interface Props {
    userId: string; // teacher_id or student_id
    userType: 'teacher' | 'student' | 'parent';
    parentToken?: string; // Special case for parent (uses token instead of ID)
}

export function NotificationPermissionBanner({ userId, userType, parentToken }: Props) {
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [isSupported, setIsSupported] = useState(true);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            setIsSupported(false);
            return;
        }
        setPermission(Notification.permission);
        setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
    }, []);

    const handleRequestPermission = async () => {
        if (!isSupported) {
            toast.error('이 환경에서는 알림을 사용할 수 없습니다.');
            return;
        }

        try {
            // 1. Request Permission
            const result = await Notification.requestPermission();
            setPermission(result);

            if (result === 'granted') {
                const registration = await navigator.serviceWorker.ready;
                if (!registration) {
                    toast.error('서비스 워커가 준비되지 않았습니다.');
                    return;
                }

                // 2. Subscribe to Push Manager
                const sub = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
                });

                // 3. Save to DB
                // Prepare payload based on user type
                const payload: any = {
                    subscription_json: sub,
                    device_type: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
                };

                if (userType === 'teacher') payload.teacher_id = userId;
                else if (userType === 'student') payload.student_id = userId;
                else if (userType === 'parent') payload.parent_token = parentToken;

                // Use insert to allow multiple devices per user
                const { error } = await supabase.from('push_subscriptions').insert(payload);

                if (error) {
                    console.error('Subscription DB Error:', error);
                    // If duplicate key error (rare with just insert unless constrained), ignore.
                }

                toast.success('알림이 성공적으로 켜졌습니다! 🔔');
            } else if (result === 'denied') {
                toast.error('알림이 차단되었습니다. 브라우저 설정에서 허용해주세요.');
            }
        } catch (error) {
            console.error('Notification Setup Error:', error);
            toast.error('알림 설정 중 오류가 발생했습니다.');
        }
    };

    if (!isSupported) return null; // Don't show if technically impossible (e.g. HTTP)
    if (permission === 'granted') return null; // Hide if already good

    return (
        <div
            onClick={handleRequestPermission}
            className="w-full p-4 mb-4 rounded-xl cursor-pointer transition-all shadow-md animate-fast-pulse flex items-center justify-between border bg-red-50 border-red-200"
        >
            <div className="flex items-center gap-3">
                <span className="text-2xl">🚨</span>
                <div className="text-left">
                    <p className="font-bold text-sm text-red-700">
                        {permission === 'denied' ? '알림이 차단되어 있습니다!' : '실시간 알림을 반드시 켜주세요'}
                    </p>
                    <p className="text-xs mt-0.5 text-red-600 font-bold">
                        {permission === 'denied'
                            ? (isIOS ? '폰 설정 > Safari > 알림 허용 필수' : '설정에서 알림을 허용해야 앱 사용 가능')
                            : '알림을 허용하지 않으면 앱 사용이 불가합니다.'}
                    </p>
                </div>
            </div>
            <div className="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap bg-green-100 text-green-700 border border-green-200 shadow-sm">
                {permission === 'denied' ? '설정 확인' : '지금 허용'}
            </div>
        </div>
    );
}
