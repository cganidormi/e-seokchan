'use client';

import { useState, useEffect, useCallback } from 'react';
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

    // 1번 조치: 무음 자동 갱신 함수 (알림 권한이 허용된 계정 접속 시 백그라운드 키 최신화)
    const autoSyncSubscription = useCallback(async () => {
        if (!userId && !parentToken) return;
        try {
            const registration = await navigator.serviceWorker.ready;
            if (!registration || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;

            let sub = await registration.pushManager.getSubscription();
            if (!sub) {
                sub = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
                });
            }

            const payload: any = {
                subscription_json: sub,
                device_type: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
                last_used_at: new Date().toISOString()
            };

            if (userType === 'teacher') payload.teacher_id = userId;
            else if (userType === 'student') payload.student_id = userId;
            else if (userType === 'parent') payload.parent_token = parentToken;

            // DB에 최신 키 무음 저장
            await supabase.from('push_subscriptions').insert(payload);
        } catch (err) {
            console.log('Silent push sync notice:', err);
        }
    }, [userId, userType, parentToken]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            setIsSupported(false);
            return;
        }
        const currentPerm = Notification.permission;
        setPermission(currentPerm);
        setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));

        // 1번 조치 실행: 이미 알림이 허용된 사용자는 백그라운드에서 키 자동 갱신
        if (currentPerm === 'granted') {
            autoSyncSubscription();
        }
    }, [autoSyncSubscription]);

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
                await autoSyncSubscription();
                toast.success('알림이 성공적으로 켜졌습니다! 🔔');
            } else if (result === 'denied') {
                toast.error(
                    '알림이 차단되어 있습니다. 알림 차단을 해제하신 후 배너를 다시 터치하시면 알림이 등록됩니다! 🔔',
                    { duration: 5000 }
                );
            }
        } catch (error) {
            console.error('Notification Setup Error:', error);
            toast.error('알림 설정 중 오류가 발생했습니다.');
        }
    };

    if (!isSupported) return null; // Don't show if technically impossible (e.g. HTTP)
    if (permission === 'granted') return null; // 알림 허용 시 배너 자동 숨김

    // 2번 조치: PWA/설치형 웹앱 맞춤 알림 재허용 유도 배너
    return (
        <div
            onClick={handleRequestPermission}
            className="w-full p-4 mb-4 rounded-xl cursor-pointer transition-all shadow-md animate-fast-pulse flex items-center justify-between border bg-red-50 border-red-200 hover:bg-red-100"
        >
            <div className="flex items-center gap-3">
                <span className="text-2xl">🚨</span>
                <div className="text-left">
                    <p className="font-bold text-sm text-red-700">
                        {permission === 'denied' ? '알림이 거부/차단되어 있습니다!' : '실시간 알림을 반드시 켜주세요'}
                    </p>
                    <p className="text-xs mt-0.5 text-red-600 font-bold">
                        {permission === 'denied'
                            ? '터치하여 알림 재허용 시도 (폰 설정에서 차단 해제 필요)'
                            : '여기를 터치하여 알림을 켜면 정상적으로 이용 가능합니다.'}
                    </p>
                </div>
            </div>
            <div className="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap bg-green-100 text-green-700 border border-green-200 shadow-sm">
                {permission === 'denied' ? '터치하여 재시도' : '지금 허용'}
            </div>
        </div>
    );
}

