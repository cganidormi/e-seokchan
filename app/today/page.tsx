"use client";

import DashboardMain from "@/components/admin/DashboardMain";
import Link from 'next/link';

export default function TodayPage() {
    return (
        <div>
            {/* Simple Header with Back Button */}
            <div className="fixed top-0 left-0 right-0 z-50 p-4 pointer-events-none flex justify-end">
                <div className="pointer-events-auto inline-block">
                    <Link
                        href="/teacher"
                        className="bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-800 px-4 py-2 rounded-xl shadow-lg font-bold hover:bg-gray-50 transition flex items-center gap-2"
                    >
                        <span>⬅</span>
                        <span>교사 홈으로</span>
                    </Link>
                </div>
            </div>

            {/* Dashboard Content */}
            <DashboardMain />
        </div>
    );
}
