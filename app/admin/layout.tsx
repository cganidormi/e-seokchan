"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const menuItems = [
    { name: "메인", path: "/admin" },
    { name: "학생관리", path: "/admin/students" },
    { name: "교사관리", path: "/admin/teachers" },
    { name: "일과표관리", path: "/admin/timetable" },
  ];

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
