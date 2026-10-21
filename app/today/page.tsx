'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardMain from "@/components/admin/DashboardMain";
import { verifyDailyToken, getKSTDateString } from '@/lib/dailyToken';
import { FaLock, FaExclamationTriangle, FaArrowRight } from 'react-icons/fa';

function TodayContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [authState, setAuthState] = useState<{
        status: 'checking' | 'teacher' | 'viewer' | 'expired' | 'unauthorized';
        targetDate?: string;
        todayDate?: string;
    }>({ status: 'checking' });

    useEffect(() => {
        const loginId = localStorage.getItem('dormichan_login_id') || sessionStorage.getItem('dormichan_login_id');
        const role = localStorage.getItem('dormichan_role') || sessionStorage.getItem('dormichan_role');

        // 1. 사감/교사용 정식 로그인 세션이 있는 경우 (전체 관리 모드)
        if (loginId && role === 'teacher') {
            setAuthState({ status: 'teacher' });
            return;
        }

        // 2. 비로그인 접근 시 URL 파라미터 검증 (당일 전용 열람 모드)
        const dateParam = searchParams.get('date');
        const tokenParam = searchParams.get('token');

        if (dateParam && tokenParam) {
            const verification = verifyDailyToken(dateParam, tokenParam);
            if (verification.isValid) {
                setAuthState({ status: 'viewer', todayDate: verification.todayDate });
                return;
            } else if (verification.reason === 'expired') {
                setAuthState({
                    status: 'expired',
                    targetDate: verification.targetDate,
                    todayDate: verification.todayDate
                });
                return;
            } else {
                setAuthState({ status: 'unauthorized' });
                return;
            }
        }

        // 3. 토큰도 없고 로그인도 안 되어 있는 경우
        setAuthState({ status: 'unauthorized' });
    }, [searchParams]);

    // 로딩 상태
    if (authState.status === 'checking') {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm font-medium text-gray-400">보안 인증 확인 중...</p>
                </div>
            </div>
        );
    }

    // 만료된 링크 (전날 링크 접속 시)
    if (authState.status === 'expired') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
                <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-100 text-center flex flex-col items-center">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 border border-amber-200 flex items-center justify-center mb-4 text-2xl shadow-xs">
                        <FaExclamationTriangle />
                    </div>
                    <h2 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">
                        링크가 만료되었습니다
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500 font-medium mt-2 leading-relaxed">
                        해당 주소는 <span className="font-bold text-gray-800">{authState.targetDate}</span> 당일 전용 열람 링크입니다.
                    </p>
                    <div className="w-full bg-gray-50 p-3.5 rounded-2xl border border-gray-100 mt-4 text-xs text-gray-600 leading-relaxed text-left">
                        💡 <strong>안내</strong><br />
                        오늘 홍지관 현황을 확인하시려면 <strong>오늘 아침 학교 메신저로 전송된 새로운 링크</strong>를 이용해 주시기 바랍니다.
                    </div>
                    <button
                        onClick={() => router.push('/login')}
                        className="mt-6 w-full py-3 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
                    >
                        <span>사감 교사 로그인</span>
                        <FaArrowRight size={10} />
                    </button>
                </div>
            </div>
        );
    }

    // 미인증 상태 (토큰 없음/불일치)
    if (authState.status === 'unauthorized') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
                <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-100 text-center flex flex-col items-center">
                    <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 border border-rose-200 flex items-center justify-center mb-4 text-2xl shadow-xs">
                        <FaLock />
                    </div>
                    <h2 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">
                        접근 권한이 없습니다
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500 font-medium mt-2 leading-relaxed">
                        올바른 전송 링크로 접속하지 않았거나 유효하지 않은 링크입니다.<br />
                        학교 메신저에 공유된 정식 링크를 확인해 주세요.
                    </p>
                    <button
                        onClick={() => router.push('/login')}
                        className="mt-6 w-full py-3 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
                    >
                        <span>로그인 페이지로 이동</span>
                        <FaArrowRight size={10} />
                    </button>
                </div>
            </div>
        );
    }

    // 사감 교사 (전체 관리 모드)
    if (authState.status === 'teacher') {
        return (
            <div>
                <DashboardMain readOnly={false} />
            </div>
        );
    }

    // 교직원/관리자 (당일 전용 열람 모드)
    return (
        <div>
            <DashboardMain readOnly={true} />
        </div>
    );
}

export default function TodayPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm font-medium text-gray-400">보안 인증 확인 중...</p>
                </div>
            </div>
        }>
            <TodayContent />
        </Suspense>
    );
}
