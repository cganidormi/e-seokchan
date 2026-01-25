'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Student } from './types';

interface Props {
    student: Student | null;
}

export default function WeeklyReturnApplicationCard({ student }: Props) {
    const [isPeriod, setIsPeriod] = useState(false);
    const [hasApplied, setHasApplied] = useState(false);
    const [loading, setLoading] = useState(true);
    const [targetMonthStr, setTargetMonthStr] = useState('');
    const [isSubscribed, setIsSubscribed] = useState(false);

    useEffect(() => {
        checkDateAndStatus();
        checkSubscription();

        if (!student) return;

        // Realtime Subscription
        const channel = supabase
            .channel(`weekly_return_${student.student_id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'monthly_return_applications',
                    filter: `student_id=eq.${student.student_id}`
                },
                (payload) => {
                    checkDateAndStatus();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [student]);

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

    const checkSubscription = async () => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            setIsSubscribed(!!subscription);
        }
    };

    const handleSubscribe = async () => {
        if (!student) return;
        setLoading(true);
        try {
            const registration = await navigator.serviceWorker.ready;
            const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

            if (!vapidPublicKey) {
                toast.error('서버 설정 오류: VAPID Key Missing');
                return;
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            });

            // DB 저장
            // 학생이면 student_id, 학부모면 parent_token을 사용 (student 객체 정보를 기반으로 판단)
            const payload: any = {
                subscription_json: subscription,
                device_type: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
            };

            if (student.parent_token) {
                // 학부모 페이지에서 접근 시 student 객체에 parent_token이 있을 수 있음
                // 하지만 parent/page.tsx에서 넘겨주는 student 객체에 parent_token이 포함되어 있는지 확인 필요.
                // 보통 parent_token으로 조회한 student 정보이므로 포함되어 있을 것임.
                // 만약 student_id만 있다면, 학생 본인으로 간주.
                // 여기서는 안전하게: parent_token이 있으면 그걸 쓰고, 없으면 student_id를 쓴다?
                // 다만, 학생 페이지에서도 student_id를 쓴다.
                // 구독 테이블의 구분은: student_id OR parent_token

                // **중요**: 학생 페이지면 student.parent_token이 없을 수도 있음 (보안상).
                // 학부모 페이지면 student.parent_token이 있음.

                // 간단히: 현재 페이지 컨텍스트를 알 수 없으니, 
                // student.parent_token이 확실히 있는 경우에만 parent_token을 사용하고,
                // 아니면 student_id를 사용한다.

                // DB 스키마: student_id, parent_token 둘 중 하나만 채워짐.
            }

            // 더 정확한 방법: localStorage의 토큰 확인?
            const pToken = localStorage.getItem('dormichan_parent_token');
            if (pToken) {
                payload.parent_token = pToken;
            } else {
                payload.student_id = student.student_id;
            }

            const { error } = await supabase.from('push_subscriptions').insert(payload);
            if (error) throw error;

            setIsSubscribed(true);
            toast.success('알림이 설정되었습니다! 🔔');
        } catch (err: any) {
            console.error(err);
            toast.error('알림 설정 실패: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const checkDateAndStatus = async () => {
        // ... (기존 로직 유지, 날짜 체크만 복원)
        if (!student) return;

        const now = new Date();
        const date = now.getDate(); // 1~31

        // 1. 날짜 체크: 10일, 11일, 12일
        const checkPeriod = date >= 10 && date <= 12;
        // const checkPeriod = true; // [테스트 모드: 사용자 요청으로 강제 활성화]
        setIsPeriod(checkPeriod);

        // 다음 달 계산 (신청 대상)
        const targetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const tYear = targetDate.getFullYear();
        const tMonth = targetDate.getMonth() + 1;
        setTargetMonthStr(`${tMonth}월`);

        // Check if applied
        try {
            const { data } = await supabase
                .from('monthly_return_applications')
                .select('*')
                .eq('student_id', student.student_id)
                .eq('target_year', tYear)
                .eq('target_month', tMonth)
                .single();

            if (data) setHasApplied(true);
            else setHasApplied(false);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async () => {
        // ... (Existing implementation)
        if (!student || loading) return;
        setLoading(true);

        const now = new Date();
        const targetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const tYear = targetDate.getFullYear();
        const tMonth = targetDate.getMonth() + 1;

        try {
            if (hasApplied) {
                const { error } = await supabase
                    .from('monthly_return_applications')
                    .delete()
                    .eq('student_id', student.student_id)
                    .eq('target_year', tYear)
                    .eq('target_month', tMonth);

                if (error) throw error;
                setHasApplied(false);
                toast.success('매주 귀가 신청이 취소되었습니다.');
            } else {
                const { error } = await supabase
                    .from('monthly_return_applications')
                    .insert({
                        student_id: student.student_id,
                        target_year: tYear,
                        target_month: tMonth
                    });

                if (error) throw error;
                setHasApplied(true);
                toast.success(`${tMonth}월 매주 귀가 신청이 완료되었습니다.`);
            }
        } catch (err: any) {
            console.error(err);
            toast.error('오류가 발생했습니다: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // 렌더링 로직: 기간이 아니면 아예 안 보임 (null)
    if (!isPeriod) return null;

    return (
        <div className="w-full max-w-md mx-auto mb-6 px-4">
            <div className={clsx(
                "w-full rounded-2xl p-5 shadow-lg border relative overflow-hidden transition-all duration-300",
                hasApplied
                    ? "bg-blue-600 border-blue-500 shadow-blue-500/30"
                    : "bg-white border-blue-100 shadow-sm"
            )}>
                {/* Background Decor */}
                <div className={clsx(
                    "absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/10 to-transparent rounded-bl-full opacity-50 pointer-events-none",
                    hasApplied ? "block" : "hidden"
                )}></div>

                <div className="relative z-10 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-1">
                            <span className={clsx(
                                "text-xs font-bold uppercase tracking-wider",
                                hasApplied ? "text-blue-200" : "text-blue-500"
                            )}>
                                매월 10일~12일 오픈
                            </span>
                            <h3 className={clsx(
                                "text-lg font-bold",
                                hasApplied ? "text-white" : "text-gray-900"
                            )}>
                                {targetMonthStr} 매주 귀가 신청
                            </h3>
                        </div>
                        <div className={clsx(
                            "px-2 py-1 rounded text-xs font-bold",
                            hasApplied ? "bg-white text-blue-600" : "bg-gray-100 text-gray-500"
                        )}>
                            {hasApplied ? "신청됨" : "미신청"}
                        </div>
                    </div>

                    <p className={clsx(
                        "text-sm mb-2",
                        hasApplied ? "text-blue-100" : "text-gray-500"
                    )}>
                        {hasApplied
                            ? `다음 달(${targetMonthStr})부터 매주 귀가자로 등록됩니다.`
                            : "매주 금요일 정기 귀가를 원하시면 신청해주세요."}
                    </p>

                    <button
                        onClick={handleToggle}
                        disabled={loading}
                        className={clsx(
                            "w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-md flex items-center justify-center gap-2",
                            hasApplied
                                ? "bg-white/20 text-white hover:bg-white/30 border border-white/20"
                                : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20"
                        )}
                    >
                        {loading && (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        )}
                        {hasApplied ? "신청 취소하기" : "신청하기"}
                    </button>
                </div>
            </div>
        </div>
    );
}
