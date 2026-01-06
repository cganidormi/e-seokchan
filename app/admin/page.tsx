"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/supabaseClient";
import Link from "next/link";

interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  currentLeaves: number;
  pendingRequests: number;
  studentsByGrade: { grade: number; count: number }[];
}

interface RecentActivity {
  id: string;
  student_id: string;
  leave_type: string;
  status: string;
  created_at: string;
  teacher_name?: string;
}

export default function AdminMainPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalTeachers: 0,
    currentLeaves: 0,
    pendingRequests: 0,
    studentsByGrade: [],
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();

    // Realtime subscription for leave requests
    const channel = supabase
      .channel("admin_dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leave_requests" },
        () => {
          console.log("Leave request changed, refreshing dashboard...");
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch total students
      const { count: studentCount } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true });

      // Fetch students by grade
      const { data: students } = await supabase
        .from("students")
        .select("grade");

      const gradeDistribution = [1, 2, 3].map((grade) => ({
        grade,
        count: students?.filter((s) => s.grade === grade).length || 0,
      }));

      // Fetch total teachers
      const { count: teacherCount } = await supabase
        .from("teachers")
        .select("*", { count: "exact", head: true });

      // Fetch current approved leaves (today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split("T")[0];

      const { data: currentLeaves } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("status", "승인")
        .gte("start_date", todayStr)
        .lte("start_date", todayStr);

      // Fetch pending requests
      const { count: pendingCount } = await supabase
        .from("leave_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "대기");

      // Fetch recent activities
      const { data: activities } = await supabase
        .from("leave_requests")
        .select("id, student_id, leave_type, status, created_at, teacher_id")
        .order("created_at", { ascending: false })
        .limit(10);

      // Fetch teacher names for activities
      const activitiesWithTeachers = await Promise.all(
        (activities || []).map(async (activity) => {
          if (activity.teacher_id) {
            const { data: teacher } = await supabase
              .from("teachers")
              .select("name")
              .eq("id", activity.teacher_id)
              .single();
            return { ...activity, teacher_name: teacher?.name };
          }
          return activity;
        })
      );

      setStats({
        totalStudents: studentCount || 0,
        totalTeachers: teacherCount || 0,
        currentLeaves: currentLeaves?.length || 0,
        pendingRequests: pendingCount || 0,
        studentsByGrade: gradeDistribution,
      });

      setRecentActivities(activitiesWithTeachers);
    } catch (error) {
      console.error("Dashboard data fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "승인":
        return "bg-green-100 text-green-700";
      case "거부":
        return "bg-red-100 text-red-700";
      case "대기":
        return "bg-blue-100 text-blue-700";
      case "취소":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "방금 전";
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    return date.toLocaleDateString("ko-KR");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">관리자 대시보드</h1>
        <p className="text-gray-600">기숙사 관리 시스템 현황을 한눈에 확인하세요</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="bg-white p-6 rounded-2xl shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <span className="text-2xl">👨‍🎓</span>
            </div>
            <span className="text-3xl font-bold text-blue-600">{stats.totalStudents}</span>
          </div>
          <h3 className="text-gray-600 font-medium mb-2">총 학생 수</h3>
          <div className="flex gap-2 text-sm text-gray-500">
            {stats.studentsByGrade.map((g) => (
              <span key={g.grade}>
                {g.grade}학년: {g.count}명
              </span>
            ))}
          </div>
        </div>

        {/* Total Teachers */}
        <div className="bg-white p-6 rounded-2xl shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <span className="text-2xl">👨‍🏫</span>
            </div>
            <span className="text-3xl font-bold text-purple-600">{stats.totalTeachers}</span>
          </div>
          <h3 className="text-gray-600 font-medium">총 교사 수</h3>
        </div>

        {/* Current Leaves */}
        <div className="bg-white p-6 rounded-2xl shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🚶</span>
            </div>
            <span className="text-3xl font-bold text-green-600">{stats.currentLeaves}</span>
          </div>
          <h3 className="text-gray-600 font-medium">현재 이석 중</h3>
          <p className="text-sm text-gray-500 mt-1">오늘 승인된 이석</p>
        </div>

        {/* Pending Requests */}
        <div className="bg-white p-6 rounded-2xl shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <span className="text-2xl">⏳</span>
            </div>
            <span className="text-3xl font-bold text-yellow-600">{stats.pendingRequests}</span>
          </div>
          <h3 className="text-gray-600 font-medium">대기 중 신청</h3>
          <p className="text-sm text-gray-500 mt-1">승인 대기 중</p>
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-xl font-bold mb-4">빠른 이동</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/admin/students"
            className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl shadow-md hover:shadow-xl transition-all hover:scale-105 text-white"
          >
            <div className="text-3xl mb-3">👨‍🎓</div>
            <h3 className="text-xl font-bold mb-2">학생 관리</h3>
            <p className="text-blue-100 text-sm">학생 정보 및 계정 관리</p>
          </Link>

          <Link
            href="/admin/teachers"
            className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-2xl shadow-md hover:shadow-xl transition-all hover:scale-105 text-white"
          >
            <div className="text-3xl mb-3">👨‍🏫</div>
            <h3 className="text-xl font-bold mb-2">교사 관리</h3>
            <p className="text-purple-100 text-sm">교사 정보 및 계정 관리</p>
          </Link>

          <Link
            href="/admin/timetable"
            className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-2xl shadow-md hover:shadow-xl transition-all hover:scale-105 text-white"
          >
            <div className="text-3xl mb-3">📅</div>
            <h3 className="text-xl font-bold mb-2">일과표 관리</h3>
            <p className="text-green-100 text-sm">시간표 및 일정 관리</p>
          </Link>
        </div>
      </div>

      {/* Recent Activities */}
      <div>
        <h2 className="text-xl font-bold mb-4">최근 활동</h2>
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          {recentActivities.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <span className="text-4xl mb-2 block">📭</span>
              최근 활동이 없습니다
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(activity.status)}`}>
                      {activity.status}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {activity.student_id} - {activity.leave_type}
                      </div>
                      {activity.teacher_name && (
                        <div className="text-sm text-gray-500">담당: {activity.teacher_name}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatDateTime(activity.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
