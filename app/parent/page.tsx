'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import WeeklyReturnApplicationCard from '@/components/student/WeeklyReturnApplicationCard';

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
    const [currentStatus, setCurrentStatus] = useState<{ type: string, text: string }>({ type: 'school', text: '학교에 있습니다' });
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const [showIOSGuide, setShowIOSGuide] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    // URL에서 토큰 가져오기 (없으면 로컬스토리지 확인)
    const token = searchParams.get('token');

    // 3. PWA 설치 프롬프트 이벤트 리스너 (Mount 시점에 바로 등록)
    useEffect(() => {
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    useEffect(() => {
        // 1. 토큰 체크
        let currentToken = token;
        if (!currentToken) {
            currentToken = localStorage.getItem('dormichan_parent_token');
        }

        if (!currentToken) {
            setLoading(false);
            return;
        }

        // 토큰 저장 (재방문 시 편의)
        localStorage.setItem('dormichan_parent_token', currentToken);

        // 중요: 학부모 모드로 진입 시, 기존 교사/학생 로그인 정보는 제거하여
        // 앱 재실행 시 학부모 페이지로 우선 연결되도록 함 (세션 충돌 방지)
        localStorage.removeItem('dormichan_login_id');
        localStorage.removeItem('dormichan_role');

        // 2. 학생 데이터 & 이석 기록 불러오기
        fetchStudentData(currentToken);

        // 3. iOS 감지 및 가이드 표시
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

        // 이미 설치된 경우는 가이드 안 보여줌
        if (isIOS && !isStandalone) {
            // 약간의 딜레이 후 표시 (사용자가 페이지를 먼저 볼 수 있게)
            setTimeout(() => setShowIOSGuide(true), 2000);
        }

        // 4. 푸시 구독 상태 확인
        checkSubscription(currentToken);

        // Realtime Subscription
        const channel = supabase
            .channel('public:leave_requests')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'leave_requests' },
                (payload) => {
                    console.log('Realtime change received!', payload);
                    fetchStudentData(currentToken!);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [token]);

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
                        setCurrentStatus({ type: 'school', text: '학교에 있습니다' });
                    }
                }
            }

        } catch (err: any) {
            console.error(err);
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
            setShowInstallPrompt(false);
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
            console.error('Push subscription failed:', err);
            toast.error('알림 설정 실패: ' + err.message);
        }
    };

    const handleParentAction = async (requestId: number, action: 'approve' | 'reject') => {
        if (!confirm(action === 'approve' ? '최종 승인하시겠습니까?' : '반려하시겠습니까?')) return;

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
                // Get teacher_id from the request
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

            toast.success(action === 'approve' ? '승인되었습니다.' : '반려되었습니다.');

            // Refresh Data
            const t = localStorage.getItem('dormichan_parent_token');
            if (t) fetchStudentData(t);

        } catch (err) {
            console.error(err);
            toast.error('처리에 실패했습니다.');
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin text-4xl">⏳</div></div>;
    }

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

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <Toaster position="top-center" />

            {/* Header */}
            <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center sticky top-0 z-10">
                <div>
                    <h1 className="text-xl font-bold text-gray-800">이석찬 ✅</h1>
                    <p className="text-xs text-gray-500">학부모 전용</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-bold">
                        {student.grade}학년 {student.class}반 {student.name}
                    </span>
                </div>
            </header>

            <main className="p-4 max-w-lg mx-auto space-y-6">

                {/* PWA Install Banner (Android/Desktop) */}
                {showInstallPrompt && (
                    <div className="bg-indigo-600 text-white p-4 rounded-xl shadow-lg flex items-center justify-between animate-fade-in-down">
                        <div>
                            <p className="font-bold">앱으로 더 편하게 확인하세요!</p>
                            <p className="text-xs text-indigo-200">설치하면 홈 화면에서 바로 접속 가능</p>
                        </div>
                        <button
                            onClick={handleInstallClick}
                            className="bg-white text-indigo-600 px-4 py-2 rounded-lg text-sm font-bold shadow-sm active:scale-95 transition-transform"
                        >
                            설치하기
                        </button>
                    </div>
                )}

                {/* iOS Install Guide Popup */}
                {showIOSGuide && (
                    <div className="fixed bottom-0 left-0 right-0 bg-white p-6 rounded-t-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.1)] z-50 animate-slide-up-fade border-t border-gray-100">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">홈 화면에 추가하기</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    아이폰에서는 앱처럼 설치하여 더 편리하게 사용할 수 있습니다.
                                </p>
                            </div>
                            <button onClick={() => setShowIOSGuide(false)} className="text-gray-400 font-bold p-2 text-xl">&times;</button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg">
                                    <img src="/ios-share.svg" alt="공유" className="w-6 h-6 text-blue-500" />
                                </div>
                                <p className="text-sm font-medium text-gray-700">
                                    1. 하단의 <span className="text-blue-500 font-bold">공유 버튼</span>을 누르세요.
                                </p>
                            </div>
                            <div className="w-px h-6 bg-gray-200 ml-5"></div>
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg">
                                    <span className="text-xl">➕</span>
                                </div>
                                <p className="text-sm font-medium text-gray-700">
                                    2. 메뉴에서 <span className="font-bold">'홈 화면에 추가'</span>를 찾아 선택하세요.
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 text-center">
                            <button
                                onClick={() => setShowIOSGuide(false)}
                                className="w-full bg-gray-100 text-gray-600 font-bold py-3 rounded-xl"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                )}

                {/* Weekly Return Application (Monthly 10th-12th) */}
                <WeeklyReturnApplicationCard student={student} />

                {/* Current Status Card */}
                <section className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                    <div className="text-center">
                        <div className={`inline-block p-4 rounded-full mb-4 ${currentStatus.type === 'school' ? 'bg-green-50' :
                            currentStatus.type === 'outing' ? 'bg-blue-50' : 'bg-purple-50'
                            }`}>
                            <span className="text-4xl">
                                {currentStatus.type === 'school' ? '🏫' :
                                    currentStatus.type === 'outing' ? '🏃' : '🌙'}
                            </span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-1">
                            {currentStatus.text}
                        </h2>
                        <p className="text-gray-500 text-sm">
                            {currentStatus.type === 'school' ? '특이사항 없음' : '귀가 예정: 확인 필요'}
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
                                                req.status === '거절' ? 'bg-red-100 text-red-700' :
                                                    req.status === '학부모승인대기' ? 'bg-orange-100 text-orange-700 animate-pulse' :
                                                        'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {req.status === '학부모승인대기' ? '학부모 승인필요' : req.status}
                                            </span>
                                        </div>
                                    </div>

                                    {/* 학부모 승인 버튼 영역 */}
                                    {req.status === '학부모승인대기' && (
                                        <div className="flex gap-2 mt-2 pt-2 border-t border-gray-50">
                                            <button
                                                onClick={() => handleParentAction(req.id, 'approve')}
                                                className="flex-1 bg-green-500 text-white text-xs font-bold py-2 rounded-lg hover:bg-green-600 active:scale-95 transition-all"
                                            >
                                                승인
                                            </button>
                                            <button
                                                onClick={() => handleParentAction(req.id, 'reject')}
                                                className="flex-1 bg-gray-100 text-gray-600 text-xs font-bold py-2 rounded-lg hover:bg-gray-200 active:scale-95 transition-all"
                                            >
                                                반려
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* Notification Settings */}
                <section className="pt-4">
                    <button
                        onClick={subscribeToPush}
                        disabled={isSubscribed}
                        className={`w-full py-4 rounded-xl font-bold shadow-sm transition-all flex items-center justify-center gap-2 ${isSubscribed
                            ? 'bg-gray-100 text-gray-400 cursor-default'
                            : 'bg-gradient-to-r from-orange-400 to-red-500 text-white shadow-orange-200 hover:shadow-orange-300 active:scale-95'
                            }`}
                    >
                        {isSubscribed ? (
                            <>
                                <span>🔔</span> 알림 받는 중
                            </>
                        ) : (
                            <>
                                <span>🔕</span> 자녀 외출/외박 알림 받기
                            </>
                        )}
                    </button>
                    <p className="text-center text-xs text-gray-400 mt-2">
                        알림을 켜두시면 승인/취소 내역을 바로 알려드립니다.
                    </p>
                </section>

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
