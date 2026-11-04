'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/supabaseClient';
import toast from 'react-hot-toast';

interface Props {
    userId: string; // teacher_id or student_id
    userType: 'teacher' | 'student' | 'parent';
    parentToken?: string; // Special case for parent (uses token instead of ID)
    studentName?: string;
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

export function NotificationPermissionBanner({ userId, userType, parentToken, studentName }: Props) {
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [isSupported, setIsSupported] = useState(true);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(true);
    const [needsManualReconnect, setNeedsManualReconnect] = useState(false);

    const isSyncingRef = useRef(false);
    const lastSyncTimeRef = useRef(0);

    // 무음 자동 갱신 함수 (앱 실행 시 구독 상태 확인 및 서버 DB 동기화)
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
            // (이미 정상 구독이 존재하는 학생은 기존 구독을 절대 해지(unsubscribe)하거나 건드리지 않음)
            let sub = await registration.pushManager.getSubscription();

            // 2. 구독이 아예 없는 경우(구독이 증발한 학생 등)에만 새로 구독 생성 시도
            if (!sub) {
                try {
                    sub = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: expectedKeyBytes
                    });
                } catch (subErr) {
                    // iOS 등에서 사용자 터치(User Gesture) 없이 백그라운드 subscribe 호출 시 차단될 수 있음
                    // 이 경우 수동 재연결 배너를 노출하여 1회 터치로 발급받도록 유도
                    console.warn('[Push] Background subscribe requires user gesture:', subErr);
                    setNeedsManualReconnect(true);
                    return;
                }
            }

            if (!sub) {
                setNeedsManualReconnect(true);
                return;
            }

            // 구독이 정상 존재하면 배너 숨김 및 키 기록
            setNeedsManualReconnect(false);
            localStorage.setItem('dormichan_active_vapid_key', currentVapidKey);

            // 3. DB에 이미 해당 학생의 현재 구독(endpoint)이 정상 등록되어 있는지 읽기 전용(SELECT)으로 확인
            let query = supabase.from('push_subscriptions').select('id, subscription_json');
            if (userType === 'teacher' && userId) query = query.eq('teacher_id', userId);
            else if (userType === 'student' && userId) query = query.eq('student_id', userId);
            else if (userType === 'parent' && parentToken) query = query.eq('parent_token', parentToken);

            const { data: existingSubs } = await query;
            const alreadyRegistered = existingSubs?.some((r: any) => {
                const ep = typeof r.subscription_json === 'string'
                    ? JSON.parse(r.subscription_json)?.endpoint
                    : r.subscription_json?.endpoint;
                return ep === sub!.endpoint;
            });

            // 이미 DB에 정상 등록되어 있는 학생이면 DB를 일절 건드리지 않고 즉시 통과(Pass)
            if (alreadyRegistered) {
                lastSyncTimeRef.current = Date.now();
                return;
            }

            const deviceType = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';

            // 4. DB에 구독이 누락된 학생만 서버 API(/api/push-sync)를 통해 안전하게 등록
            const syncRes = await fetch('/api/push-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userType,
                    userId,
                    parentToken,
                    subscription: sub,
                    deviceType
                })
            });

            if (syncRes.ok) {
                lastSyncTimeRef.current = Date.now();
            }
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

    const isHongSeokHyun = !!(
        (userId && (String(userId).includes('2220') || String(userId).includes('홍석현'))) ||
        (studentName && studentName.includes('홍석현'))
    );
    const [isForceDismissed, setIsForceDismissed] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('hong_notif_done_v2') === 'true' || sessionStorage.getItem('hong_notif_done') === 'true';
        }
        return false;
    });

    // 홍석현 학생 전용: 처음 설치 시와 동일한 방식으로 알림 허용 + DB 등록 + 즉시 테스트 푸시 발송
    const handleHongSeokHyunPermission = async () => {
        if (!isSupported) {
            toast.error('이 환경에서는 실시간 알림을 사용할 수 없습니다.');
            return;
        }

        try {
            toast.loading('알림 설정을 진행 중입니다...', { id: 'push-setup' });

            const result = await Notification.requestPermission();
            setPermission(result);

            if (result !== 'granted') {
                toast.error('알림이 차단되어 있습니다. 스마트폰 설정에서 알림 차단을 해제 후 다시 눌러주세요! 🔔', { id: 'push-setup', duration: 5000 });
                return;
            }

            const registration = await navigator.serviceWorker.ready;
            if (!registration) {
                toast.error('서비스 워커를 준비할 수 없습니다.', { id: 'push-setup' });
                return;
            }

            // 1. 기존 구형 구독 완전 파기
            const existingSub = await registration.pushManager.getSubscription();
            if (existingSub) {
                try {
                    await existingSub.unsubscribe();
                    console.log('[Push] Force-unsubscribed existing subscription for Hong Seok-hyun');
                } catch (unsubErr) {
                    console.warn('[Push] Unsubscribe error:', unsubErr);
                }
            }

            localStorage.removeItem('dormichan_active_vapid_key');

            // 2. 최신 VAPID 키로 깨끗한 새 구독 발급
            const currentVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!currentVapidKey) {
                toast.error('VAPID 키가 누락되었습니다.', { id: 'push-setup' });
                return;
            }
            const expectedKeyBytes = urlBase64ToUint8Array(currentVapidKey);

            const newSub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: expectedKeyBytes
            });

            if (!newSub) {
                toast.error('새 알림 구독 생성에 실패했습니다.', { id: 'push-setup' });
                return;
            }

            localStorage.setItem('dormichan_active_vapid_key', currentVapidKey);

            // 3. 서버 API(/api/push-sync)를 통해 기존 홍석현 토큰 모두 정리(RLS 우회) 후 신규 저장
            const targetStudentId = userId || '2220홍석현';
            const deviceType = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
            await fetch('/api/push-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userType: 'student',
                    userId: targetStudentId,
                    subscription: newSub,
                    deviceType,
                    forceCleanUser: true
                })
            });

            // 4. 즉시 테스트 알림 전송 (학생 기기에서 정상 수신 즉시 확인)
            try {
                await fetch('/api/web-push', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        subscription: newSub,
                        title: '🔔 알림 연결 완료',
                        message: '홍석현 학생, 실시간 알림이 성공적으로 연결되었습니다!'
                    })
                });
            } catch (testPushErr) {
                console.warn('Test push send error:', testPushErr);
            }

            toast.success('실시간 알림이 성공적으로 켜졌습니다! 🔔', { id: 'push-setup', duration: 4000 });
            setNeedsManualReconnect(false);
            setIsForceDismissed(true);
            localStorage.setItem('hong_notif_done_v2', 'true');
            sessionStorage.setItem('hong_notif_done', 'true');
        } catch (error: any) {
            console.error('Hong Seok Hyun Push Setup Error:', error);
            toast.error('알림 설정 오류: ' + (error?.message || error), { id: 'push-setup' });
        }
    };

    const handleRequestPermission = async () => {
        if (!isSupported) {
            toast.error('이 환경에서는 실시간 알림을 사용할 수 없습니다.');
            return;
        }

        try {
            const result = await Notification.requestPermission();
            setPermission(result);

            if (result === 'granted') {
                // 사용자 터치(User Gesture) 컨텍스트 내에서 직접 구독 확인 및 생성
                const currentVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
                if (currentVapidKey) {
                    const registration = await navigator.serviceWorker.ready;
                    if (registration) {
                        const expectedKeyBytes = urlBase64ToUint8Array(currentVapidKey);
                        let sub = await registration.pushManager.getSubscription();
                        if (!sub) {
                            sub = await registration.pushManager.subscribe({
                                userVisibleOnly: true,
                                applicationServerKey: expectedKeyBytes
                            });
                        }
                        if (sub) {
                            const deviceType = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
                            await fetch('/api/push-sync', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    userType,
                                    userId,
                                    parentToken,
                                    subscription: sub,
                                    deviceType
                                })
                            });
                            localStorage.setItem('dormichan_active_vapid_key', currentVapidKey);
                            setNeedsManualReconnect(false);
                        }
                    }
                } else {
                    await autoSyncSubscription();
                }
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

    // 홍석현 학생 전용: 처음 설치 시와 동일한 형태의 알림 허용 뱃지 강제 노출
    if (isHongSeokHyun && !isForceDismissed) {
        return (
            <div
                onClick={handleHongSeokHyunPermission}
                className="w-full p-4 mb-4 rounded-xl cursor-pointer transition-all shadow-md animate-fast-pulse flex items-center justify-between border bg-red-50 border-red-200 hover:bg-red-100"
            >
                <div className="flex items-center gap-3">
                    <span className="text-2xl">🚨</span>
                    <div className="text-left">
                        <p className="font-bold text-sm text-red-700">
                            실시간 알림을 반드시 켜주세요
                        </p>
                        <p className="text-xs mt-0.5 text-red-600 font-bold">
                            여기를 터치하여 알림을 켜면 정상적으로 이용 가능합니다.
                        </p>
                    </div>
                </div>
                <div className="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap bg-green-100 text-green-700 border border-green-200 shadow-sm hover:bg-green-200">
                    지금 허용
                </div>
            </div>
        );
    }

    if (permission === 'granted' && !needsManualReconnect) return null; // 알림 허용 및 구독 정상 존재 시 배너 자동 숨김

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


