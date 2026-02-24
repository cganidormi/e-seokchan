'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/supabaseClient';

export default function TeacherLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            const loginId = localStorage.getItem('dormichan_login_id') || sessionStorage.getItem('dormichan_login_id');
            const role = localStorage.getItem('dormichan_role') || sessionStorage.getItem('dormichan_role');

            if (!loginId || role !== 'teacher') {
                router.replace('/login');
                return;
            }

            // [최적화] 매번 DB를 조회하지 않고 로그인 시 기록된 마커(또는 이미 세션이 있는 상태)를 신뢰합니다.
            const passwordChecked = localStorage.getItem('dormichan_password_checked');

            setIsAuthorized(true);
        };

        checkAuth();
    }, [router]);

    // Lazy Sync & Notification Trigger
    useEffect(() => {
        if (!isAuthorized) return;

        const checkAndSync = async () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1; // 0-indexed
            const day = now.getDate();
            const todayString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            // 1. Lazy Sync (매월 1일 이후 체크)
            if (day >= 1) {

                try {
                    const { error } = await supabase.rpc('sync_weekly_returnees', {
                        t_year: year,
                        t_month: month
                    });

                    if (error) {
                        console.error('[Lazy Sync] Error:', error.message);
                    } else {

                    }
                } catch (e) {
                    console.error('[Lazy Sync] Exception:', e);
                }
            }

            // 2. Lazy Notification
            // 10일: 오후 12시(12) 이후 발송
            // 12일: 오후 7시(19) 이후 발송
            const hour = now.getHours();

            if ((day === 10 && hour >= 12) || (day === 12 && hour >= 19)) {
                const type = day === 10 ? 'period_start' : 'period_end';


                try {
                    fetch('/api/notifications/trigger', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ date: todayString, type })
                    })
                        .then(res => res.json())
                        .then(data => { })
                        .catch(err => console.error('[Lazy Noti] API Error:', err));
                } catch (e) {
                    console.error('[Lazy Noti] Exception:', e);
                }
            }
        };

        checkAndSync();
    }, [isAuthorized]);

    // 진입 즉시 하위 컴포넌트(children)를 렌더링하도록 조건부 렌더링을 가벼운 null로 처리합니다.
    if (!isAuthorized) {
        return null;
    }

    return <>{children}</>;
}
