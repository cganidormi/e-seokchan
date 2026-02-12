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

            try {
                // Check if password change is required
                const { data, error } = await supabase
                    .from('teachers_auth')
                    .select('must_change_password')
                    .eq('teacher_id', loginId)
                    .single();

                if (data?.must_change_password) {
                    router.replace(`/change-password?role=teacher&id=${loginId}`);
                    return;
                }
            } catch (e) {
                console.error("Auth check error:", e);
            }

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

    if (!isAuthorized) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin"></div>
                    <span className="text-gray-500 font-medium">권한 확인 중...</span>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
