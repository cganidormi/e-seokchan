'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardMain from "@/components/admin/DashboardMain";

export default function TodayPage() {
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        const loginId = localStorage.getItem('dormichan_login_id') || sessionStorage.getItem('dormichan_login_id');
        const role = localStorage.getItem('dormichan_role') || sessionStorage.getItem('dormichan_role');

        if (!loginId || role !== 'teacher') {
            router.replace('/login');
            return;
        }

        setIsAuthorized(true);
    }, [router]);

    if (!isAuthorized) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm font-medium text-gray-400">보안 인증 확인 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Dashboard Content */}
            <DashboardMain />
        </div>
    );
}
