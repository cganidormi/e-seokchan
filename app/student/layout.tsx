'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/supabaseClient';

export default function StudentLayout({
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

            if (!loginId || (role !== 'student' && role !== 'monitor')) {
                router.replace('/login');
                return;
            }

            // Only check password change for students (not monitors for now, as monitors_auth schema might differ)
            if (role === 'student') {
                try {
                    const { data, error } = await supabase
                        .from('students_auth')
                        .select('must_change_password')
                        .eq('student_id', loginId)
                        .maybeSingle();

                    if (data?.must_change_password) {
                        router.replace(`/change-password?role=student&id=${loginId}`);
                        return;
                    }
                } catch (e) {
                    console.error("Auth check error:", e);
                }
            }

            setIsAuthorized(true);
        };

        checkAuth();
    }, [router]);

    if (!isAuthorized) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-yellow-200 border-t-yellow-500 rounded-full animate-spin"></div>
                    <span className="text-gray-500 font-medium">권한 확인 중...</span>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
