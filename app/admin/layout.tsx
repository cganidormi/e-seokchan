'use client';
import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/supabaseClient";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const loginId = localStorage.getItem('dormichan_login_id') || sessionStorage.getItem('dormichan_login_id');
      const role = localStorage.getItem('dormichan_role') || sessionStorage.getItem('dormichan_role');

      // 1. 교사 세션이 없으면 즉시 로그인으로 차단
      if (!loginId || role !== 'teacher') {
        router.replace('/login');
        return;
      }

      // 2. 실제 DB의 teachers 테이블에 존재하는 유효한 교사인지 이중 검증
      try {
        const { data: teacher, error } = await supabase
          .from('teachers')
          .select('id, name, position')
          .ilike('name', `%${loginId.trim()}%`)
          .limit(1);

        if (error || !teacher || teacher.length === 0) {
          console.warn('[Admin Guard] Unauthorized access attempt detected:', loginId);
          localStorage.removeItem('dormichan_login_id');
          localStorage.removeItem('dormichan_role');
          router.replace('/login');
          return;
        }

        setIsAuthorized(true);
      } catch (err) {
        console.error('[Admin Guard] Auth check failed:', err);
        router.replace('/login');
      }
    };

    checkAuth();
  }, [router]);

  const menuItems = [
    { name: "오늘의 홍지관", path: "/admin" },
    { name: "학생관리", path: "/admin/students" },
    { name: "교사관리", path: "/admin/teachers" },
    { name: "일과표관리", path: "/admin/timetable" },
  ];

  // 인가되지 않은 사용자는 0.1초도 관리자 화면을 볼 수 없도록 즉시 차단
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
    <div className="flex flex-col md:flex-row min-h-screen">
      <aside className="w-full md:w-32 bg-gray-900 text-white p-2 flex flex-row md:flex-col gap-2 overflow-x-auto whitespace-nowrap shadow-md md:shadow-none z-10">
        <Link
          href="/teacher"
          className="p-2 rounded text-sm hover:bg-gray-800 text-yellow-400 font-bold border border-yellow-400/30 flex items-center justify-center gap-2 flex-shrink-0"
        >
          <span>⬅</span>
          <span>교사 페이지</span>
        </Link>
        <div className="w-px h-auto bg-gray-700 mx-1 md:w-auto md:h-px md:mx-0 md:my-1" />
        {menuItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`p-2 rounded text-sm flex-shrink-0 ${isActive ? "bg-gray-700" : "hover:bg-gray-800"
                }`}
            >
              {item.name}
            </Link>
          );
        })}
      </aside>

      <main className="flex-1 p-4 overflow-x-hidden bg-white text-gray-900 min-h-screen">{children}</main>
    </div>
  );
}
