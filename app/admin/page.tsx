"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/supabaseClient";
import Link from "next/link";
import { QRCodeSVG } from 'qrcode.react';
import toast, { Toaster } from 'react-hot-toast';

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
  const [showQR, setShowQR] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

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
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split("T")[0];

      // Execute all independent queries in parallel
      const [
        studentsResult,
        teachersResult,
        currentLeavesResult,
        pendingCountResult,
        activitiesResult
      ] = await Promise.all([
        // 1. Students (Count & Data for Grade dist)
        supabase.from("students").select("grade", { count: "exact" }),

        // 2. Teachers (Count & Data for Name map)
        supabase.from("teachers").select("id, name", { count: "exact" }),

        // 3. Current Approved Leaves (Today)
        supabase.from("leave_requests")
          .select("*")
          .eq("status", "승인")
          .gte("start_date", todayStr)
          .lte("start_date", todayStr),

        // 4. Pending Requests (Count only)
        supabase.from("leave_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "대기"),

        // 5. Recent Activities
        supabase.from("leave_requests")
          .select("id, student_id, leave_type, status, created_at, teacher_id")
          .order("created_at", { ascending: false })
          .limit(10)
      ]);

      // Process Results
      const students = studentsResult.data || [];
      const studentCount = studentsResult.count || 0;

      const teachers = teachersResult.data || [];
      const teacherCount = teachersResult.count || 0;

      const currentLeaves = currentLeavesResult.data || [];
      const pendingRequests = pendingCountResult.count || 0;
      const activities = activitiesResult.data || [];

      // Calculate Grade Distribution
      const gradeDistribution = [1, 2, 3].map((grade) => ({
        grade,
        count: students.filter((s: any) => s.grade === grade).length,
      }));

      // Create Teacher Map for fast lookup
      const teacherMap = new Map();
      teachers.forEach((t: any) => {
        teacherMap.set(t.id, t.name);
      });

      // Map Activities with Teacher Names
      const activitiesWithTeachers = activities.map((activity: any) => ({
        ...activity,
        teacher_name: activity.teacher_id ? teacherMap.get(activity.teacher_id) : undefined,
      }));

      setStats({
        totalStudents: studentCount,
        totalTeachers: teacherCount,
        currentLeaves: currentLeaves.length,
        pendingRequests: pendingRequests,
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
      <Toaster />
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">관리자 대시보드</h1>
          <p className="text-gray-600">기숙사 관리 시스템 현황을 한눈에 확인하세요</p>
        </div>
        <button
          onClick={() => setShowQR(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-xl shadow-lg transition-all flex items-center gap-2 text-sm"
        >
          <span>📲</span>
          <span>앱 설치 QR</span>
        </button>
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


      {
        showQR && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in" onClick={() => setShowQR(false)}>
            <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center relative" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setShowQR(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                &times;
              </button>

              <div className="mb-6">
                <span className="text-4xl">📲</span>
              </div>

              <h3 className="text-2xl font-extrabold text-gray-800 mb-2">이석찬 앱 설치</h3>
              <p className="text-gray-500 mb-6 text-sm">
                학생들에게 카메라로 주소를 스캔하도록 안내해주세요.<br />
                자동으로 설치 페이지로 연결됩니다.
              </p>

              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-inner inline-block mb-4">
                {origin && <QRCodeSVG value={origin} size={200} level={"H"} includeMargin={true} />}
              </div>

              <div
                className="bg-gray-50 p-3 rounded-lg text-xs text-gray-500 break-all select-all cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText(origin);
                  toast.success('주소가 복사되었습니다.');
                }}
              >
                {origin}
              </div>
              <p className="text-xs text-gray-400 mt-2">클릭하여 주소 복사</p>

              <button
                onClick={() => setShowQR(false)}
                className="w-full mt-6 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        )
      }
    </div >
  );
}
