'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/supabaseClient';
import toast from 'react-hot-toast';

interface Props {
    userId: string; // teacher_id or student_id
    userType: 'teacher' | 'student' | 'parent';
    parentToken?: string; // Special case for parent (uses token instead of ID)
}

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Uint8Array 또는 ArrayBuffer VAPID 키 일치 여부 정밀 비교
function areKeysEqual(buf: ArrayBuffer | null | undefined, expectedKey: Uint8Array): boolean {
    if (!buf) return false;
    const actual = new Uint8Array(buf);
    if (actual.length !== expectedKey.length) return false;
    for (let i = 0; i < actual.length; i++) {
        if (actual[i] !== expectedKey[i]) return false;
    }
    return true;
}

export function NotificationPermissionBanner({ userId, userType, parentToken }: Props) {
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [isSupported, setIsSupported] = useState(true);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(true);

    const isSyncingRef = useRef(false);
    const lastSyncTimeRef = useRef(0);

    // 무음 자동 갱신 함수 (앱 실행 시 최신 VAPID 키 검사 및 구형 토큰 강제 파기/재발급)
    const autoSyncSubscription = useCallback(async () => {
        if (!userId && !parentToken) return;
        const currentVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!currentVapidKey) return;

        // 과도한 중복 호출 방지 (30초 이내 중복 실행 차단 및 동시 실행 방지)
        if (isSyncingRef.current) return;
        if (Date.now() - lastSyncTimeRef.current < 30000) return;
        isSyncingRef.current = true;

        try {
            const registration = await navigator.serviceWorker.ready;
            if (!registration) return;

            const expectedKeyBytes = urlBase64ToUint8Array(currentVapidKey);

            // 1. 현재 브라우저에 등록된 PushSubscription 확인
            let sub = await registration.pushManager.getSubscription();

            // 2. 기존 구독이 최신 VAPID 키로 생성된 것인지 정밀 검사
            let isCurrentKey = false;
            if (sub) {
                // (1) sub.options.applicationServerKey 검사
                const existingKeyBuffer = sub.options?.applicationServerKey;
                const bufferMatch = areKeysEqual(existingKeyBuffer, expectedKeyBytes);

                // (2) localStorage에 기록된 키와 일치 여부 확인
                const savedKey = localStorage.getItem('dormichan_active_vapid_key');
                const storageMatch = savedKey === currentVapidKey;

                // 키 버퍼가 제공되는 경우 버퍼 일치 여부 우선, 미제공 시 storage 확인
                isCurrentKey = existingKeyBuffer ? bufferMatch : storageMatch;
            }

            let oldEndpoint: string | null = null;

            // 3. 만약 기존 구독이 옛날 키이거나 유효하지 않다면 즉시 파기(unsubscribe)
            if (sub && !isCurrentKey) {
                console.log('[Push] Outdated VAPID key detected. Forcing unsubscribe and renewal...');
                oldEndpoint = sub.endpoint;
                try {
                    await sub.unsubscribe();
                } catch (unsubErr) {
                    console.warn('[Push] Error unsubscribing outdated subscription:', unsubErr);
                }
                sub = null;
            }

            // 4. 구독이 없거나 방금 파기했다면 최신 VAPID 키로 새로 구독 생성
            if (!sub) {
                sub = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: expectedKeyBytes
                });
                console.log('[Push] Successfully created fresh subscription with latest VAPID key!');
            }

            if (!sub) return;

            // 최신 키를 localStorage에 영구 기록
            localStorage.setItem('dormichan_active_vapid_key', currentVapidKey);

            const payload: any = {
                subscription_json: sub,
                device_type: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
                last_used_at: new Date().toISOString()
            };

            if (userType === 'teacher') payload.teacher_id = userId;
            else if (userType === 'student') payload.student_id = userId;
            else if (userType === 'parent') payload.parent_token = parentToken;

            // 5. 옛날 구형 endpoint가 있었다면 DB에서 이전 레코드 삭제 정리
            if (oldEndpoint && oldEndpoint !== sub.endpoint) {
                try {
                    let oldQuery = supabase.from('push_subscriptions').select('id, subscription_json');
                    if (userType === 'teacher') oldQuery = oldQuery.eq('teacher_id', userId);
                    else if (userType === 'student') oldQuery = oldQuery.eq('student_id', userId);
                    else if (userType === 'parent') oldQuery = oldQuery.eq('parent_token', parentToken);

                    const { data: oldRows } = await oldQuery;
                    const oldMatchIds = oldRows?.filter((r: any) => {
                        const ep = typeof r.subscription_json === 'string'
                            ? JSON.parse(r.subscription_json)?.endpoint
                            : r.subscription_json?.endpoint;
                        return ep === oldEndpoint;
                    }).map((r: any) => r.id);

                    if (oldMatchIds && oldMatchIds.length > 0) {
                        await supabase.from('push_subscriptions').delete().in('id', oldMatchIds);
                        console.log(`[Push] Removed ${oldMatchIds.length} obsolete subscriptions for updated key.`);
                    }
                } catch (cleanErr) {
                    console.warn('[Push] Error cleaning up old endpoint row:', cleanErr);
                }
            }

            // 6. 최신 토큰 DB 업서트 (동일 endpoint가 있으면 last_used_at 갱신, 없으면 insert)
            const endpoint = sub.endpoint;
            let existingId: string | null = null;
            if (endpoint) {
                let query = supabase.from('push_subscriptions').select('id, subscription_json');
                if (userType === 'teacher') query = query.eq('teacher_id', userId);
                else if (userType === 'student') query = query.eq('student_id', userId);
                else if (userType === 'parent') query = query.eq('parent_token', parentToken);

                const { data: existing } = await query;
                const match = existing?.find((e: any) => {
                    const ep = typeof e.subscription_json === 'string'
                        ? JSON.parse(e.subscription_json)?.endpoint
                        : e.subscription_json?.endpoint;
                    return ep === endpoint;
                });
                if (match) existingId = match.id;
            }

            if (existingId) {
                await supabase.from('push_subscriptions').update({
                    last_used_at: payload.last_used_at,
                    device_type: payload.device_type,
                    subscription_json: sub
                }).eq('id', existingId);
            } else {
                await supabase.from('push_subscriptions').insert(payload);
            }
            lastSyncTimeRef.current = Date.now();
        } catch (err) {
            console.log('Silent push sync notice:', err);
        } finally {
            isSyncingRef.current = false;
        }
    }, [userId, userType, parentToken]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const iosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
        setIsIOS(iosDevice);

        const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
        setIsStandalone(!!standalone);

        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            setIsSupported(false);
            return;
        }

        const handleVisibilityOrFocus = () => {
            const currentPerm = Notification.permission;
            setPermission(currentPerm);

            // 앱이 화면에 표시되었을 때 (최초 마운트 또는 백그라운드 멀티태스킹에서 앱 복귀 시)
            if (document.visibilityState === 'visible' && currentPerm === 'granted') {
                autoSyncSubscription();
            }
        };

        // 1. 초기 마운트 시 즉시 검사
        handleVisibilityOrFocus();

        // 2. 백그라운드 멀티태스킹에서 앱으로 복귀 시 실시간 감지
        document.addEventListener('visibilitychange', handleVisibilityOrFocus);
        window.addEventListener('focus', handleVisibilityOrFocus);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
            window.removeEventListener('focus', handleVisibilityOrFocus);
        };
    }, [autoSyncSubscription]);

    const handleRequestPermission = async () => {
        if (!isSupported) {
            toast.error('이 환경에서는 실시간 알림을 사용할 수 없습니다.');
            return;
        }

        try {
            const result = await Notification.requestPermission();
            setPermission(result);

            if (result === 'granted') {
                await autoSyncSubscription();
                toast.success('알림이 성공적으로 켜졌습니다! 🔔');
            } else if (result === 'denied') {
                toast.error(
                    '알림이 차단되어 있습니다. 스마트폰 설정에서 알림 차단을 해제해주세요! 🔔',
                    { duration: 5000 }
                );
            }
        } catch (error) {
            console.error('Notification Setup Error:', error);
            toast.error('알림 설정 중 오류가 발생했습니다.');
        }
    };

    // 아이폰 사파리 탭으로 접속하여 알림 API를 지원하지 않는 경우: 홈화면 추가 안내 배너 노출
    if (!isSupported && isIOS && !isStandalone) {
        return (
            <div className="w-full p-4 mb-4 rounded-xl shadow-md border bg-indigo-50 border-indigo-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">📱</span>
                    <div className="text-left">
                        <p className="font-bold text-sm text-indigo-800">
                            아이폰 알림 받기 설정 안내
                        </p>
                        <p className="text-xs mt-0.5 text-indigo-600 font-medium">
                            사파리 하단 <strong>[공유] ➔ [홈 화면에 추가]</strong>로 앱을 설치해야 실시간 알림을 받을 수 있습니다.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (!isSupported) return null; // 그 외 기술적 미지원 브라우저는 숨김
    if (permission === 'granted') return null; // 알림 허용 시 배너 자동 숨김

    // 알림 미허용 또는 차단 사용자 대상 안내 배너
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
                            ? '스마트폰 설정에서 알림 차단 해제 후 터치해주세요'
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


