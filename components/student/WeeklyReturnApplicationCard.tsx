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
    const [overrideEntry, setOverrideEntry] = useState<any>(null); // DB override entry
    const [loading, setLoading] = useState(true);
    const [currentMonthStr, setCurrentMonthStr] = useState('');
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
                () => {
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

            const payload: any = {
                subscription_json: subscription,
                device_type: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
            };

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
        if (!student) return;

        const now = new Date();
        const date = now.getDate();

        // 1. 날짜 체크: 10일~12일 (신청 기간)
        // [3월 예외] 17일~19일로 임시 변경
        const isMarch = now.getMonth() + 1 === 3;
        const checkPeriod = isMarch 
            ? (date >= 17 && date <= 19)
            : (date >= 10 && date <= 12);
        setIsPeriod(checkPeriod);

        // 현재 달 계산
        const cMonth = now.getMonth() + 1;
        setCurrentMonthStr(`${cMonth}월`);

        // 다음 달 계산
        const targetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const tYear = targetDate.getFullYear();
        const tMonth = targetDate.getMonth() + 1;
        setTargetMonthStr(`${tMonth}월`);

        try {
            const { data } = await supabase
                .from('monthly_return_applications')
                .select('*')
                .eq('student_id', student.student_id)
                .eq('target_year', tYear)
                .eq('target_month', tMonth)
                .single();

            setOverrideEntry(data || null);
        } catch (error) {
            setOverrideEntry(null);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async () => {
        if (!student || loading) return;
        setLoading(true);

        const now = new Date();
        const targetNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const tYear = targetNextMonth.getFullYear();
        const tMonth = targetNextMonth.getMonth() + 1;

        // 현재 상태와 목표 상태 결정
        const currentStatus = !!student.weekend;
        const targetStatus = overrideEntry ? !!overrideEntry.is_weekly : currentStatus;
        const newTargetStatus = !targetStatus;

        try {
            if (newTargetStatus === currentStatus) {
                // 기본 상태로 되돌리는 경우 -> DB 레코드 삭제
                const { error } = await supabase
                    .from('monthly_return_applications')
                    .delete()
                    .eq('student_id', student.student_id)
                    .eq('target_year', tYear)
                    .eq('target_month', tMonth);

                if (error) throw error;
                toast.success('기본 상태로 유지하도록 설정되었습니다.');
            } else {
                // 상태를 변경하는 경우 -> DB 레코드 삽입/업데이트
                const { error } = await supabase
                    .from('monthly_return_applications')
                    .upsert({
                        student_id: student.student_id,
                        target_year: tYear,
                        target_month: tMonth,
                        is_weekly: newTargetStatus
                    }, { onConflict: 'student_id, target_year, target_month' });

                if (error) throw error;
                toast.success(`${tMonth}월 상태가 '${newTargetStatus ? '매주귀가' : '격주귀가'}'로 변경 예약되었습니다.`);
            }
        } catch (err: any) {
            console.error(err);
            toast.error('오류가 발생했습니다: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const IS_SUSPENDED = false; // 기능을 일시 중단하려면 true로 설정

    if (IS_SUSPENDED || !isPeriod || !student) return null;

    const currentStatus = !!student.weekend;
    const nextMonthStatus = overrideEntry ? !!overrideEntry.is_weekly : currentStatus;
    const hasOverride = !!overrideEntry;

    return (
        <div className="w-full max-w-md mx-auto mb-6 px-4">
            <div className={clsx(
                "w-full rounded-2xl p-5 shadow-lg border relative overflow-hidden transition-all duration-300",
                nextMonthStatus
                    ? "bg-blue-600 border-blue-500 shadow-blue-500/30"
                    : "bg-white border-blue-100 shadow-sm"
            )}>
                {/* Background Decor */}
                <div className={clsx(
                    "absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/10 to-transparent rounded-bl-full opacity-50 pointer-events-none",
                    nextMonthStatus ? "block" : "hidden"
                )}></div>

                <div className="relative z-10 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-1">
                            <span className={clsx(
                                "text-xs font-bold uppercase tracking-wider",
                                nextMonthStatus ? "text-blue-200" : "text-blue-500"
                            )}>
                                매월 10일~12일 상태 변경 가능
                            </span>
                            <h3 className={clsx(
                                "text-lg font-bold",
                                nextMonthStatus ? "text-white" : "text-gray-900"
                            )}>
                                {targetMonthStr} 귀가 형태 결정
                            </h3>
                        </div>
                        <div className={clsx(
                            "px-2 py-1 rounded text-xs font-bold",
                            nextMonthStatus ? "bg-white text-blue-600" : "bg-blue-100 text-blue-600"
                        )}>
                            {nextMonthStatus ? "매주귀가" : "격주귀가"}
                        </div>
                    </div>

                    <div className={clsx(
                        "text-sm mb-2 p-3 rounded-xl border",
                        nextMonthStatus
                            ? "bg-white/10 border-white/20 text-blue-50"
                            : "bg-gray-50 border-gray-100 text-gray-500"
                    )}>
                        <p className="mb-1 text-xs">
                            <span className="font-extrabold opacity-80">[{currentMonthStr} 현재]</span> {currentStatus ? "매주귀가 중" : "격주귀가 중"}
                        </p>
                        <p className="text-base font-bold">
                            <span className="opacity-80">[{targetMonthStr} 예정]</span> {nextMonthStatus ? "매주귀가" : "격주귀가"}
                            {hasOverride && <span className="ml-2 text-xs bg-white/20 px-1.5 py-0.5 rounded animate-pulse font-black">(변경됨)</span>}
                        </p>
                    </div>

                    <p className={clsx(
                        "text-xs mb-1",
                        nextMonthStatus ? "text-blue-100" : "text-gray-400"
                    )}>
                        {hasOverride
                            ? "변경 내용을 취소하고 현재 상태를 유지하시겠습니까?"
                            : "다음 달의 귀가 형태를 바꾸고 싶을 때만 아래 버튼을 누르세요."}
                    </p>

                    <button
                        onClick={handleToggle}
                        disabled={loading}
                        className={clsx(
                            "w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-md flex items-center justify-center gap-2",
                            nextMonthStatus
                                ? "bg-white text-blue-600 hover:bg-gray-100 shadow-white/20"
                                : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20"
                        )}
                    >
                        {loading && (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        )}
                        {hasOverride
                            ? "변경 취소 (현재 상태 유지)"
                            : (currentStatus ? "격주귀가로 변경 신청" : "매주귀가로 변경 신청")}
                    </button>
                </div>
            </div>
        </div>
    );
}
