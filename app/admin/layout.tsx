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
    { name: "더미 데이터", path: "/admin/dummy" },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="w-32 bg-gray-900 text-white p-2 flex flex-col gap-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`p-2 rounded text-sm ${
                isActive ? "bg-gray-700" : "hover:bg-gray-800"
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </aside>

      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
