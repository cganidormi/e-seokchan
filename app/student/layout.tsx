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

            // [최적화] 매번 DB를 조회하지 않고, 로그인 시 기록된 마커(또는 이미 세션이 있는 상태)를 신뢰합니다.
            // (만약 강제로 비밀번호를 바꿔야 하는 특수한 상황이라면 백그라운드에서 검사하도록 나중에 추가할 수 있지만, 
            // 현재는 앱 로딩 속도가 최우선이므로 DB 통신을 제거합니다.)
            const passwordChecked = localStorage.getItem('dormichan_password_checked');

            // 만약 로컬스토리지에 로그인 마커만 있고 password_checked가 없다면
            // (기존 로그인 유지 상태의 사용자들), 호환성을 위해 조용히 통과시킵니다.

            setIsAuthorized(true);
        };

        checkAuth();
    }, [router]);

    // isAuthorized 로딩 화면을 완전히 제거하여 진입 즉시 하위 컴포넌트(children)를 렌더링하도록 합니다.
    // 권한이 없어서 쫓겨나는 짧은 찰나에만 본 화면이 안 보이도록 조건부 렌더링합니다.
    if (!isAuthorized) {
        return null; // 지연 0초
    }

    return <>{children}</>;
}
