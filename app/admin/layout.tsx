"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const menuItems = [
    { name: "메인", path: "/admin" },
    { name: "학생 관리", path: "/admin/students" },
    { name: "교사 관리", path: "/admin/teachers" },
    { name: "일과표 관리", path: "/admin/timetable" },
    { name: "더미 데이터", path: "/admin/dummy" },
  ];

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* 왼쪽 사이드바 */}
      <aside className="w-56 bg-gray-900 text-white p-4 flex flex-col gap-3">
        <h2 className="text-xl font-bold mb-4">관리자</h2>

        {menuItems.map((item) => {
          const isActive = pathname === item.path;

          return (
            <Link
              key={item.path}
              href={item.path}
              className={`px-3 py-2 rounded-md text-sm font-medium transition 
                ${
                  isActive
                    ? "bg-gray-700 text-yellow-300"
                    : "text-gray-300 hover:bg-gray-800"
                }
              `}
            >
              {item.name}
            </Link>
          );
        })}
      </aside>

      {/* 오른쪽 컨텐츠 영역 */}
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
