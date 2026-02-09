'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import WeeklyReturnApplicationCard from '@/components/student/WeeklyReturnApplicationCard';
import { NotificationPermissionBanner } from '@/components/NotificationPermissionBanner';

// 헬퍼: VAPID 키를 Uint8Array로 변환
function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function ParentContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [student, setStudent] = useState<any>(null);
    const [leaveHistory, setLeaveHistory] = useState<any[]>([]);
    const [currentStatus, setCurrentStatus] = useState<{ type: string, text: string }>({ type: 'school', text: '교내 학습 중입니다.' });
    const [isSubscribed, setIsSubscribed] = useState(false);

    // PWA State
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isStandalone, setIsStandalone] = useState(false); // Default to false
    const [isIOS, setIsIOS] = useState(false);
    const [isChromeIOS, setIsChromeIOS] = useState(false);
    const [isChecked, setIsChecked] = useState(false); // To ensure we checked the environment

    // URL에서 토큰 가져오기 (없으면 로컬스토리지 확인)
    const token = searchParams.get('token');

    // ---------------------------------------------------------
    // 1. PWA Environment Check & Install Prompt Listener
    // ---------------------------------------------------------
    useEffect(() => {
        // Detect Standalone
        const checkStandalone = () => {
            return (
                window.matchMedia('(display-mode: standalone)').matches ||
                (navigator as any).standalone ||
                document.referrer.includes('android-app://')
            );
        };
        const inStandalone = checkStandalone();
        setIsStandalone(inStandalone);

        // Detect iOS & Browser Type
        const userAgent = navigator.userAgent;
        const iOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
        setIsIOS(iOS);

        // Detect Chrome on iOS (Real Device OR DevTools Simulation)
        // CriOS: Real Chrome App on iOS
        // Google Inc: Chrome DevTools simulating iOS
        const isChrome = /CriOS/.test(userAgent) || (iOS && navigator.vendor === 'Google Inc.');

        if (isChrome) {
            setIsChromeIOS(true);
        }

        setIsChecked(true);

        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    // ---------------------------------------------------------
    // 2. Data Fetching & Subscription (Only if Standalone/Authorized)
    // ---------------------------------------------------------
    useEffect(() => {
        // Token Logic
        let currentToken = token;
        if (!currentToken) {
            currentToken = localStorage.getItem('dormichan_parent_token');
        }

        if (currentToken) {
            // Save token immediately (even if in browser, so it might persist)
            localStorage.setItem('dormichan_parent_token', currentToken);

            // Clear conflicting sessions
            localStorage.removeItem('dormichan_login_id');
            localStorage.removeItem('dormichan_role');
        }

        // If NOT checked yet, wait
        if (!isChecked) return;

        // Force Install: If NOT standalone, stop here (don't fetch data yet, just show install gate)
        // STRICT MODE: No localhost exception
        if (!isStandalone) {
            setLoading(false);
            return;
        }

        if (!currentToken) {
            setLoading(false);
            return; // Will show "Invalid Token" screen
        }

        // Fetch Data
        fetchStudentData(currentToken);
        checkSubscription(currentToken);

        // Realtime Subscription
        const channel = supabase
            .channel('public:leave_requests')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'leave_requests' },
                (payload) => {
                    fetchStudentData(currentToken!);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [token, isChecked, isStandalone]);


    const fetchStudentData = async (t: string) => {
        try {
            // 학생 정보 조회
            const { data: studentData, error: studentError } = await supabase
                .from('students')
                .select('*')
                .eq('parent_token', t)
                .single();

            if (studentError || !studentData) {
                throw new Error('유효하지 않은 토큰입니다.');
            }

            setStudent(studentData);

            // 이석 기록 조회 (최근 5건)
            if (studentData.student_id) {
                const { data: history, error: historyError } = await supabase
                    .from('leave_requests')
                    .select('*')
                    .like('student_id', `${studentData.grade}${studentData.class}%${studentData.name}%`)
                    .in('leave_type', ['외출', '외박'])
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (!historyError) {
                    setLeaveHistory(history || []);

                    // 현재 상태 판별 로직
                    const now = new Date();
                    const activeLeave = (history || []).find((req: any) => {
                        const start = new Date(req.start_time);
                        const end = new Date(req.end_time);
                        return req.status === '승인' && now >= start && now <= end;
                    });

                    if (activeLeave) {
                        setCurrentStatus({
                            type: activeLeave.leave_type === '외박' ? 'sleepover' : 'outing',
                            text: `${activeLeave.leave_type} 중입니다`
                        });
                    } else {
                        setCurrentStatus({ type: 'school', text: '교내 학습 중입니다.' });
                    }
                }
            }

        } catch (err: any) {
            toast.error(err.message || '데이터를 불러오지 못했습니다.');
            localStorage.removeItem('dormichan_parent_token'); // 잘못된 토큰이면 삭제
        } finally {
            setLoading(false);
        }
    };

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            // User accepted
        }
        setDeferredPrompt(null);
    };

    // -------------------------
    // Push Notification Logic
    // -------------------------
    const checkSubscription = async (currentToken: string) => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            setIsSubscribed(!!subscription);
        }
    };

    const subscribeToPush = async () => {
        const currentToken = localStorage.getItem('dormichan_parent_token');
        if (!currentToken) return toast.error('토큰이 없습니다.');

        try {
            const registration = await navigator.serviceWorker.ready;
            const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

            if (!vapidPublicKey) {
                return toast.error('서버 설정(VAPID)이 필요합니다.');
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            });

            // DB에 저장
            await supabase.from('push_subscriptions').insert({
                parent_token: currentToken,
                subscription_json: subscription,
                device_type: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
            });

            setIsSubscribed(true);
            toast.success('알림이 설정되었습니다! 🔔');

        } catch (err: any) {
            toast.error('알림 설정 실패: ' + err.message);
        }
    };

    const handleParentAction = async (requestId: number, action: 'approve' | 'reject') => {
        if (!confirm(action === 'approve' ? '1차 승인하시겠습니까?' : '반려하시겠습니까?')) return;

        setLoading(true);
        try {
            const updateData = action === 'approve'
                ? { status: '학부모승인', parent_approval_status: 'approved' }
                : { status: '거절', parent_approval_status: 'rejected' };

            const { error } = await supabase
                .from('leave_requests')
                .update(updateData)
                .eq('id', requestId);

            if (error) throw error;

            // ---------------------------------------------------------
            // Push Notification to Teacher (Parent Approved)
            // ---------------------------------------------------------
            if (action === 'approve') {
                const { data: reqData } = await supabase.from('leave_requests').select('teacher_id, leave_type, student_id').eq('id', requestId).single();
                if (reqData && reqData.teacher_id) {
                    const { data: tSubs } = await supabase.from('push_subscriptions').select('subscription_json').eq('teacher_id', reqData.teacher_id);
                    if (tSubs && tSubs.length > 0) {
                        Promise.all(tSubs.map(sub =>
                            fetch('/api/web-push', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    subscription: sub.subscription_json,
                                    title: '학부모 승인 완료',
                                    message: `[${reqData.leave_type}] 학부모 승인이 완료되었습니다. 최종 승인해주세요.`
                                })
                            }).catch(e => console.error(e))
                        ));
                    }
                }
            }
            // ---------------------------------------------------------

            toast.success(action === 'approve' ? '1차 승인이 완료되었습니다.' : '반려되었습니다.');

            // Refresh Data
            const t = localStorage.getItem('dormichan_parent_token');
            if (t) fetchStudentData(t);

        } catch (err) {
            console.error(err);
            toast.error('처리에 실패했습니다.');
            setLoading(false);
        }
    };

    // ---------------------------------------------------------
    // RENDER
    // ---------------------------------------------------------

    // 1. Loading
    if (loading && isChecked) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin text-4xl">⏳</div></div>;
    }

    // 2. Install Gate (Blocking Screen)
    // Only show if NOT standalone
    if (isChecked && !isStandalone) {
        return (
            <div
                className="min-h-screen flex flex-col items-center justify-center p-6 text-center text-white relative overflow-hidden"
                style={{
                    backgroundImage: `url('/dorm.jpg')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                }}
            >
                {/* Overlay for better readability */}
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-0"></div>

                {/* Content */}
                <div className="z-10 bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-3xl shadow-2xl max-w-sm w-full relative">
                    <div className="text-6xl mb-6">📲</div>
                    <h1 className="text-2xl font-bold mb-2">앱 설치가 필요합니다</h1>
                    <p className="text-gray-200 text-sm mb-8 leading-relaxed">
                        실시간 알림(외출/외박 승인 등)을 받기 위해<br />
                        <strong>이석찬 앱</strong>을 설치해주세요.
                    </p>

                    {isIOS ? (
                        <div className="bg-white/90 text-gray-800 p-5 rounded-xl text-left border border-white/50 shadow-inner">
                            <p className="font-bold text-center mb-4 text-indigo-800">
                                � {isChromeIOS ? 'Chrome' : 'Safari'}에서 설치하기
                            </p>
                            <div className="space-y-4 text-sm">
                                {/* Step 1: Share Button */}
                                <div className="flex items-start gap-4">
                                    <div className="min-w-[40px] h-[40px] bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M12 15V3M12 3L7 8M12 3L17 8M4 12V19C4 20.1 4.9 21 6 21H18C19.1 21 20 20.1 20 19V12" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 mb-1">1. 공유 버튼 누르기</p>
                                        <p className="text-gray-500 text-xs">
                                            {isChromeIOS
                                                ? '우측 상단에 있습니다.'
                                                : '화면 하단 중앙에 있는 아이콘입니다.'}
                                        </p>
                                    </div>
                                </div>

                                {/* Step 2: Add to Home */}
                                <div className="flex items-start gap-4">
                                    <div className="min-w-[40px] h-[40px] bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                                        <span className="text-lg">➕</span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 mb-1">2. 홈 화면에 추가</p>
                                        <p className="text-gray-500 text-xs">메뉴 목록에서 찾아주세요.</p>
                                    </div>
                                </div>

                                {/* Step 3: Confirm */}
                                <div className="flex items-start gap-4">
                                    <div className="min-w-[40px] h-[40px] bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                                        <span className="font-bold text-blue-500 text-xs">Add</span>
                                    </div>
                                    <div className="flex items-center h-[40px]">
                                        <p className="font-bold text-gray-800">
                                            상단 '추가' 버튼 누르면 완료!
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <button
                                onClick={handleInstallClick}
                                disabled={!deferredPrompt}
                                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all ${deferredPrompt
                                    ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:scale-105 active:scale-95'
                                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                {deferredPrompt ? '✨ 앱 설치하고 시작하기' : '설치 준비 중...'}
                            </button>
                            {!deferredPrompt && (
                                <p className="text-xs text-gray-400">
                                    설치 버튼이 안 보이면 브라우저 메뉴에서<br /> '앱 설치'를 눌러주세요.
                                </p>
                            )}
                        </div>
                    )}

                    <div className="mt-8 pt-6 border-t border-white/10">
                        <p className="text-xs text-gray-400">
                            설치 후 홈 화면에 생성된<br />아이콘으로 접속해주세요.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // 3. No Token Error
    if (!student) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
                <Toaster />
                <h1 className="text-2xl font-bold text-gray-800 mb-4">접근할 수 없습니다.</h1>
                <p className="text-gray-600 mb-6">올바르지 않은 링크이거나 자녀 정보를 찾을 수 없습니다.</p>
                <p className="text-sm text-gray-400">선생님께 받은 링크를 다시 확인해주세요.</p>
            </div>
        );
    }

    // 4. Main Dashboard (Authenticated & Standalone)
    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <Toaster position="top-center" />

            {/* Header */}
            <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center sticky top-0 z-10">
                <div>
                    <h1 className="text-xl font-bold text-gray-800">강원과학고등학교</h1>
                    <p className="text-xs text-gray-500">KSHS 통합 이석 관리 플랫폼 학부모 페이지</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-bold">
                        {student.grade}학년 {student.class}반 {student.name}
                    </span>
                </div>
            </header>

            <main className="p-4 max-w-lg mx-auto space-y-6">

                {/* Notification Settings */}
                {/* Notification Settings */}
                {/* Replaced with Persistent Banner */}
                {student && (
                    <NotificationPermissionBanner
                        userId={student.student_id ? student.student_id : 'parent'}
                        userType="parent"
                        parentToken={token || localStorage.getItem('dormichan_parent_token') || ''}
                    />
                )}

                {/* Weekly Return Application (Monthly 10th-12th) */}
                <WeeklyReturnApplicationCard student={student} />

                {/* Current Status Card */}
                <section className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                    <div className="text-center">
                        <div className={`inline-block rounded-full mb-4 ${currentStatus.type === 'school' ? '' :
                            (currentStatus.type === 'outing' ? 'bg-blue-50 p-4' : 'bg-purple-50 p-4')
                            }`}>
                            <div className="flex justify-center items-center w-24 h-24">
                                {currentStatus.type === 'school' ? (
                                    <img src="/images/school_emblem.png" alt="강원과학고" className="w-full h-full object-contain" />
                                ) : (
                                    <span className="text-4xl">
                                        {currentStatus.type === 'outing' ? '🏃' : '🌙'}
                                    </span>
                                )}
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-1">
                            {currentStatus.text}
                        </h2>
                        <p className="text-gray-500 text-sm">
                            {currentStatus.type === 'school'
                                ? `${new Date().getMonth() + 1}월의 매주귀가 상태 : ${student?.weekend ? '매주귀가' : '격주귀가'}`
                                : '귀가 예정: 확인 필요'}
                        </p>
                    </div>
                </section>

                {/* Leave History */}
                <section>
                    <h3 className="font-bold text-gray-700 mb-3 px-1">최근 이석/외박 내역</h3>
                    <div className="space-y-3">
                        {leaveHistory.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 bg-white rounded-2xl border border-dashed">
                                기록이 없습니다.
                            </div>
                        ) : (
                            leaveHistory.map((req) => (
                                <div key={req.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${req.leave_type === '외출' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                                                    }`}>
                                                    {req.leave_type}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {new Date(req.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <p className="text-sm font-medium text-gray-800">
                                                {new Date(req.start_time).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} ~
                                                {new Date(req.end_time).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">{req.reason}</p>
                                        </div>
                                        <div>
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${req.status === '승인' ? 'bg-green-100 text-green-700' :
                                                (req.status === '거절' || req.status === '반려') ? 'bg-red-100 text-red-700' :
                                                    req.status === '학부모승인대기' ? 'bg-orange-100 text-orange-700 animate-pulse' :
                                                        'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {req.status === '학부모승인대기' ? '1차 승인 대기중' :
                                                    req.status === '학부모승인' ? '2차 승인 대기중' :
                                                        req.status === '거절' ? '1차 반려' :
                                                            req.status === '반려' ? '2차 반려' :
                                                                req.status}
                                            </span>
                                        </div>
                                    </div>

                                    {/* 학부모 승인 버튼 영역 */}
                                    {/* 학부모 승인 버튼 영역 */}
                                    {(() => {
                                        const now = new Date();
                                        const endTime = new Date(req.end_time);
                                        const isExpired = now > endTime;

                                        if (isExpired && req.status !== '승인' && req.status !== '거절' && req.status !== '취소' && req.status !== '복귀') {
                                            return (
                                                <div className="mt-2 pt-2 border-t border-gray-50 text-center">
                                                    <p className="text-xs text-gray-400 font-medium">
                                                        ⚠️ 기간이 만료된 요청입니다.
                                                    </p>
                                                </div>
                                            );
                                        }

                                        if (req.status === '학부모승인대기') {
                                            return (
                                                <div className="flex gap-2 mt-2 pt-2 border-t border-gray-50">
                                                    <button
                                                        onClick={() => handleParentAction(req.id, 'approve')}
                                                        className="flex-1 bg-green-500 text-white text-xs font-bold py-2 rounded-lg hover:bg-green-600 active:scale-95 transition-all"
                                                    >
                                                        1차 승인
                                                    </button>
                                                    <button
                                                        onClick={() => handleParentAction(req.id, 'reject')}
                                                        className="flex-1 bg-gray-100 text-gray-600 text-xs font-bold py-2 rounded-lg hover:bg-gray-200 active:scale-95 transition-all"
                                                    >
                                                        반려
                                                    </button>
                                                </div>
                                            );
                                        } else if (req.status === '학부모승인') {
                                            return (
                                                <div className="flex gap-2 mt-2 pt-2 border-t border-gray-50">
                                                    <button
                                                        onClick={() => handleParentAction(req.id, 'reject')}
                                                        className="w-full bg-red-100 text-red-600 text-xs font-bold py-2 rounded-lg hover:bg-red-200 active:scale-95 transition-all"
                                                    >
                                                        승인 취소 (반려)
                                                    </button>
                                                </div>
                                            );
                                        } else if (req.status === '승인') {
                                            return (
                                                <div className="mt-2 pt-2 border-t border-gray-50 text-center">
                                                    <p className="text-xs text-gray-400 font-medium">
                                                        ✅ 선생님 최종 승인이 완료되어 변경할 수 없습니다.
                                                    </p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                            ))
                        )}
                    </div>
                </section>

                <div className="pt-8 pb-4 text-center">
                    <p className="text-xs text-gray-300">Dormichan Parent App</p>
                </div>

            </main>

            {/* Manual Refresh (Floating) */}
            <button
                onClick={() => {
                    setLoading(true);
                    const t = localStorage.getItem('dormichan_parent_token');
                    if (t) fetchStudentData(t);
                }}
                className="fixed bottom-6 right-6 bg-white p-3 rounded-full shadow-lg border border-gray-100 text-xl active:rotate-180 transition-transform"
            >
                🔄
            </button>

        </div>
    );
}

export default function ParentPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin text-4xl">⏳</div></div>}>
            <ParentContent />
        </Suspense>
    );
}
