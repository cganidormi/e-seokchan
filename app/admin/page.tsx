"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/supabaseClient";
import Link from "next/link";
import { QRCodeSVG } from 'qrcode.react';
import toast, { Toaster } from 'react-hot-toast';
import {
  FaUserFriends, FaBuilding, FaBed, FaWalking, FaWrench,
  FaFirstAid, FaHome, FaPlus, FaTrash, FaBell, FaMobileAlt,
  FaUserGraduate, FaChartPie, FaChevronDown, FaCheck
} from "react-icons/fa";

// Types
interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  studentsByGrade: { grade: number; count: number; overnight: number; current: number }[];
  studentsByFloor: { floor: number; capacity: number; assigned: number; current: number }[];
  currentLeaves: { overnight: number; short: number };
  violationCount: number;
}

interface WeeklyReturnee {
  student_id: string;
  name: string;
  grade: number;
  class: number;
  number: number;
}

interface FacilityRequest {
  id: number;
  title: string;
  description: string;
  status: string;
  room_number?: number;
  created_at: string;
}

interface Patient {
  id: number;
  student_id: string;
  student_name?: string;
  symptom: string;
  status: string;
  note: string;
  created_at: string;
}

export default function AdminMainPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalTeachers: 0,
    studentsByGrade: [],
    studentsByFloor: [],
    currentLeaves: { overnight: 0, short: 0 },
    violationCount: 0,
  });

  const [weeklyReturnees, setWeeklyReturnees] = useState<WeeklyReturnee[]>([]);
  const [facilityRequests, setFacilityRequests] = useState<FacilityRequest[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);

  // Date State
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [isLoading, setIsLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [origin, setOrigin] = useState('');

  // Form States
  const [newFacility, setNewFacility] = useState({ title: '', room: '' });
  const [newPatient, setNewPatient] = useState({ studentId: '', symptom: '' });

  // Refresh Trigger for Realtime
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setOrigin(window.location.origin);
    fetchDashboardData();
  }, [selectedDate, refreshKey]);

  // Realtime Setup
  useEffect(() => {
    const handleRealtimeUpdate = () => {
      setRefreshKey(prev => prev + 1);
    };

    const channels = [
      supabase.channel('admin_dash_leaves').on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, handleRealtimeUpdate),
      supabase.channel('admin_dash_seats').on('postgres_changes', { event: '*', schema: 'public', table: 'seat_assignments' }, handleRealtimeUpdate),
      supabase.channel('admin_dash_students').on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, handleRealtimeUpdate),
      supabase.channel('admin_dash_facility').on('postgres_changes', { event: '*', schema: 'public', table: 'facility_requests' }, () => fetchFacilityData()), // These have their own fetchers, might be OK to keep distinct or unify
      supabase.channel('admin_dash_patients').on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, () => fetchPatientData()),
      supabase.channel('admin_dash_rooms').on('postgres_changes', { event: '*', schema: 'public', table: 'room_layouts' }, handleRealtimeUpdate),
      supabase.channel('admin_dash_violations').on('postgres_changes', { event: '*', schema: 'public', table: 'morning_checks' }, handleRealtimeUpdate),
    ];

    channels.forEach(c => c.subscribe());

    return () => {
      channels.forEach(c => supabase.removeChannel(c));
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      const targetDateStr = selectedDate.toISOString().split("T")[0];

      // 1. Students & Weekly Returnees
      const { data: studentsData } = await supabase.from("students").select("*");
      const students = studentsData || [];
      const totalStudents = students.length;

      const weekly = students.filter((s: any) => s.weekend).sort((a: any, b: any) => {
        if (a.grade !== b.grade) return a.grade - b.grade;
        if (a.class !== b.class) return a.class - b.class;
        return a.number - b.number;
      });
      setWeeklyReturnees(weekly);

      // 2. Teachers
      const { count: teacherCount } = await supabase.from("teachers").select("*", { count: "exact", head: true });

      // 3. Leaves (Filtered by Selected Date)
      const { data: leavesData } = await supabase
        .from("leave_requests")
        .select("student_id, leave_type")
        .eq("status", "승인")
        .lte("start_date", targetDateStr)
        .gte("end_date", targetDateStr);

      const activeLeaves = leavesData || [];
      const overnight = activeLeaves.filter((l: any) => l.leave_type === '외박').length;
      const short = activeLeaves.filter((l: any) => l.leave_type === '외출').length;

      // Helper to count leaves for a specific subset
      const countLeaves = (subsetStudents: any[], type?: '외박' | '외출') => {
        const subsetIds = new Set(subsetStudents.map((s: any) => s.student_id));
        return activeLeaves.filter((l: any) => {
          if (!subsetIds.has(l.student_id)) return false;
          if (type) return l.leave_type === type;
          return true;
        }).length;
      };

      // 5. Violation Counter (Morning Checks - 'late')
      // Count for the SELECTED DATE
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { count: violationCount } = await supabase
        .from('morning_checks')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'late')
        .gte('checked_at', startOfDay.toISOString())
        .lte('checked_at', endOfDay.toISOString());

      // 4. Floor Stats (Capacity & Current)
      // Fetch Room Layouts (Capacity) & Seat Assignments (Current Assigned)
      const { data: roomsData } = await supabase.from("room_layouts").select("room_number, total_seats");
      const { data: seatsData } = await supabase.from("seat_assignments").select("room_number, student_id");

      const floorStats = [1, 2, 3, 4].map(floor => {
        // Rooms on this floor (e.g. 100-199)
        const floorRooms = (roomsData || []).filter((r: any) => r.room_number >= floor * 100 && r.room_number < (floor + 1) * 100);
        const capacity = floorRooms.reduce((acc: number, r: any) => acc + r.total_seats, 0);

        // Assigned students on this floor
        const assignedSeats = (seatsData || []).filter((s: any) => s.room_number >= floor * 100 && s.room_number < (floor + 1) * 100);
        const assignedCount = assignedSeats.length;

        // Check how many of these assigned students are currently Absent (Overnight or Short)
        // "Current" = Assigned - Absent
        const assignedStudentIds = new Set(assignedSeats.map((s: any) => s.student_id));
        const absentCount = activeLeaves.filter((l: any) => assignedStudentIds.has(l.student_id)).length;

        return {
          floor,
          capacity: capacity > 0 ? capacity : 0, // Default to 0 if no data
          assigned: assignedCount,
          current: Math.max(0, assignedCount - absentCount)
        };
      });

      // 5. Grade Stats
      const gradeStats = [1, 2, 3].map(g => {
        const gradeStudents = students.filter((s: any) => s.grade === g);
        const total = gradeStudents.length;
        const overnightCount = countLeaves(gradeStudents, '외박');
        const totalAbsent = countLeaves(gradeStudents); // Overnight + Short
        return {
          grade: g,
          count: total,
          overnight: overnightCount,
          current: Math.max(0, total - totalAbsent)
        };
      });

      setStats({
        totalStudents,
        totalTeachers: teacherCount || 0,
        studentsByGrade: gradeStats,
        studentsByFloor: floorStats,
        currentLeaves: { overnight, short },
        violationCount: violationCount || 0,
      });

      fetchFacilityData();
      fetchPatientData();

    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFacilityData = async () => {
    const { data } = await supabase.from("facility_requests").select("*").order("created_at", { ascending: false });
    setFacilityRequests(data || []);
  };

  const fetchPatientData = async () => {
    const { data: patientData } = await supabase.from("patients").select("*").order("created_at", { ascending: false });
    if (patientData) {
      const { data: students } = await supabase.from("students").select("student_id, name");
      const studentMap = new Map(students?.map((s: any) => [s.student_id, s.name]));

      const merged = patientData.map((p: any) => ({
        ...p,
        student_name: studentMap.get(p.student_id) || p.student_id
      }));
      setPatients(merged);
    }
  };

  // --- Handlers ---
  const handleCreateFacility = async () => {
    if (!newFacility.title) return toast.error("제목을 입력하세요");
    await supabase.from("facility_requests").insert({
      title: newFacility.title,
      room_number: newFacility.room ? parseInt(newFacility.room) : null,
      status: '대기'
    });
    setNewFacility({ title: '', room: '' });
    toast.success("등록되었습니다");
  };

  const handleDeleteFacility = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase.from("facility_requests").delete().eq("id", id);
    toast.success("삭제되었습니다");
  };

  const handleToggleFacilityStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === '완료' ? '대기' : '완료';
    await supabase.from("facility_requests").update({ status: newStatus }).eq("id", id);
    toast.success(`상태가 ${newStatus}로 변경되었습니다`);
  }

  const handleCreatePatient = async () => {
    if (!newPatient.studentId || !newPatient.symptom) return toast.error("정보를 입력하세요");
    await supabase.from("patients").insert({
      student_id: newPatient.studentId,
      symptom: newPatient.symptom,
      status: '기숙사'
    });
    setNewPatient({ studentId: '', symptom: '' });
    toast.success("등록되었습니다");
  };

  const handleDeletePatient = async (id: number) => {
    if (!confirm("삭제하시겠습니까? (완치)")) return;
    await supabase.from("patients").delete().eq("id", id);
    toast.success("삭제되었습니다");
  };

  // --- Filter Helpers ---
  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();
  };

  const isToday = (d: Date) => {
    const today = new Date();
    return isSameDay(d, today);
  }

  const filteredFacility = facilityRequests.filter(req => {
    const created = new Date(req.created_at);
    if (isToday(selectedDate)) {
      return req.status !== '완료' || isSameDay(created, selectedDate);
    }
    return isSameDay(created, selectedDate);
  });

  const filteredPatients = patients.filter(p => {
    const created = new Date(p.created_at);
    if (isToday(selectedDate)) {
      return p.status !== '완치' || isSameDay(created, selectedDate);
    }
    return isSameDay(created, selectedDate);
  });


  // Date String for Header
  const isSelectedToday = isSameDay(new Date(), selectedDate);
  const dateString = isSelectedToday
    ? `${selectedDate.getFullYear()}. ${selectedDate.getMonth() + 1}. ${selectedDate.getDate()} (오늘)`
    : `${selectedDate.getFullYear()}. ${selectedDate.getMonth() + 1}. ${selectedDate.getDate()}`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FDFDFD]">
        <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-gray-800 font-sans pb-24 md:pb-8">
      <Toaster />

      {/* Header */}
      <div className="px-6 pt-12 pb-6 flex items-center justify-between sticky top-0 bg-[#FDFDFD]/90 backdrop-blur-md z-10 transition-all">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-lg text-gray-600 font-bold">
            D
          </div>

          {/* Functional Date Picker */}
          <div className="relative group">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50 transition">
              <span className="font-bold text-sm text-gray-700">{dateString}</span>
              <FaChevronDown className="text-xs text-gray-400" />
            </div>
            {/* Simple HTML Date Input Overlay */}
            <input
              type="date"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) => {
                if (e.target.value) setSelectedDate(new Date(e.target.value));
              }}
            />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowQR(true)} className="w-10 h-10 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-600 hover:bg-gray-50 active:scale-95 transition">
            <FaMobileAlt />
          </button>
          <button className="w-10 h-10 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-600 hover:bg-gray-50 active:scale-95 transition relative">
            <FaBell />
            <span className="absolute top-2 right-3 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
          </button>
        </div>
      </div>

      <div className="px-6 space-y-8 max-w-xl mx-auto md:max-w-4xl mt-2">

        {/* Section 1: Overview (Custom Layout) */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <FaChartPie className="text-gray-400" /> <span className="text-gray-600">Overview</span>
            </h2>
          </div>

          {/* 1. Grade Overview */}
          {/* 1. Grade Overview (List Style) */}
          {/* 1. Grade Overview (List Style) */}
          {/* 1. Grade Overview (List Style) */}
          <div className="space-y-3">
            {stats.studentsByGrade.map(g => (
              <div key={g.grade} className="bg-white px-5 py-3 rounded-[1.5rem] border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${g.grade === 1 ? 'bg-blue-50 text-blue-500' : g.grade === 2 ? 'bg-purple-50 text-purple-500' : 'bg-orange-50 text-orange-500'}`}>
                    {g.grade}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-gray-700">{g.grade}학년</span>
                    <div className="w-px h-3 bg-gray-200 mx-1"></div>
                    <p className="text-sm text-gray-500 font-medium whitespace-nowrap flex items-center gap-2">
                      <span>총원 <strong className="text-gray-800">{g.count}</strong></span>
                      <span className="w-px h-3 bg-gray-300"></span>
                      <span>외박 <strong className="text-red-500">{g.overnight}</strong></span>
                      <span className="w-px h-3 bg-gray-300"></span>
                      <span>현재 <strong className="text-blue-600">{g.current}명</strong></span>
                    </p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-white group-hover:shadow-sm transition-all">
                  <FaChevronDown className="-rotate-90 text-xs" />
                </div>
              </div>
            ))}
          </div>

          {/* Total Summary */}
          <div className="bg-gray-900 text-white p-4 rounded-2xl shadow-sm flex justify-between items-center px-8">
            <div className="text-sm font-light">전체 현황</div>
            <div className="flex gap-6 text-lg font-bold">
              <span>정원 : {stats.totalStudents}명</span>
              <span>현재원 : {stats.studentsByGrade.reduce((acc, curr) => acc + curr.current, 0)}명</span>
            </div>
          </div>

          {/* 2. Floor Overview (List Style) */}
          <div className="space-y-3">
            {stats.studentsByFloor.map(f => (
              <div key={f.floor} className="bg-white px-5 py-3 rounded-[1.5rem] border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-sm font-bold text-indigo-500">
                    {f.floor}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-gray-700">{f.floor}F</span>
                    <div className="w-px h-3 bg-gray-200 mx-1"></div>
                    <p className="text-sm text-gray-500 font-medium whitespace-nowrap flex items-center gap-2">
                      <span>정원 <strong className="text-gray-800">{f.capacity}</strong></span>
                      <span className="w-px h-3 bg-gray-300"></span>
                      <span>현재 <strong className="text-indigo-600">{f.current}명</strong></span>
                    </p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-white group-hover:shadow-sm transition-all">
                  <FaChevronDown className="-rotate-90 text-xs" />
                </div>
              </div>
            ))}
          </div>

          {/* 3. Violation Counter (Placeholder) */}
          <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-500">
                <FaBell />
              </div>
              <span className="font-bold text-red-900">일과시간 미준수자</span>
            </div>
            <span className="text-2xl font-bold text-red-600">{stats.violationCount}명</span>
          </div>
        </div>

        {/* Section 2: Tasks List */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-800">Tasks & Requests</h2>
            <span className="bg-white px-2 py-0.5 rounded-full text-xs font-bold text-gray-500 border border-gray-100 shadow-sm">
              {filteredFacility.length + filteredPatients.length}
            </span>
          </div>

          <div className="space-y-4">
            {/* Facility Card */}
            <div className="bg-white p-6 rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-50">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 p-2 rounded-xl text-blue-500"><FaWrench /></div>
                  <h3 className="font-bold text-gray-800">시설물 수리 요청</h3>
                </div>
              </div>

              <div className="mb-4 flex gap-2">
                <input
                  type="text"
                  className="bg-gray-50 border-none rounded-xl px-4 py-3 text-sm w-full outline-none focus:bg-gray-100 transition"
                  placeholder="예: 305호 에어컨 고장"
                  value={newFacility.title}
                  onChange={e => setNewFacility({ ...newFacility, title: e.target.value })}
                />
                <button onClick={handleCreateFacility} className="bg-gray-900 text-white w-12 rounded-xl flex items-center justify-center hover:bg-black active:scale-95 transition">
                  <FaPlus />
                </button>
              </div>

              <div className="space-y-3">
                {filteredFacility.length === 0 ? (
                  <div className="text-center py-4 text-gray-300 text-sm">요청 내역이 없습니다</div>
                ) : filteredFacility.map(req => (
                  <div key={req.id} className="group flex items-center p-3 hover:bg-gray-50 rounded-2xl transition-colors cursor-pointer border border-transparent hover:border-gray-100">
                    <div
                      className={`w-5 h-5 rounded-md border-2 mr-3 flex items-center justify-center cursor-pointer transition-colors ${req.status === '완료' ? 'bg-blue-500 border-blue-500' : 'border-gray-300 hover:border-blue-400'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFacilityStatus(req.id, req.status);
                      }}
                    >
                      {req.status === '완료' && <FaCheck className="text-white text-[10px]" />}
                    </div>
                    <div className="flex-1">
                      <h4 className={`font-bold text-sm transition-colors ${req.status === '완료' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{req.title}</h4>
                      <p className="text-xs text-gray-400">
                        {req.room_number ? `${req.room_number}호` : '공용'} • {req.created_at.substring(5, 10)}
                      </p>
                    </div>
                    <button onClick={() => handleDeleteFacility(req.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 p-2 transition">
                      <FaTrash />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Patient Card */}
            <div className="bg-white p-6 rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-50">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-red-50 p-2 rounded-xl text-red-500"><FaFirstAid /></div>
                  <h3 className="font-bold text-gray-800">환자 관리 (보건실)</h3>
                </div>
              </div>

              <div className="mb-4 flex gap-2">
                <input
                  type="text"
                  className="bg-gray-50 border-none rounded-xl px-4 py-3 text-sm w-24 outline-none focus:bg-gray-100"
                  placeholder="학번"
                  value={newPatient.studentId}
                  onChange={e => setNewPatient({ ...newPatient, studentId: e.target.value })}
                />
                <input
                  type="text"
                  className="bg-gray-50 border-none rounded-xl px-4 py-3 text-sm flex-1 outline-none focus:bg-gray-100"
                  placeholder="증상"
                  value={newPatient.symptom}
                  onChange={e => setNewPatient({ ...newPatient, symptom: e.target.value })}
                />
                <button onClick={handleCreatePatient} className="bg-red-500 text-white w-12 rounded-xl flex items-center justify-center hover:bg-red-600 active:scale-95 transition">
                  <FaPlus />
                </button>
              </div>

              <div className="space-y-3">
                {filteredPatients.length === 0 ? (
                  <div className="text-center py-4 text-gray-300 text-sm">환자가 없습니다</div>
                ) : filteredPatients.map(p => (
                  <div key={p.id} className="group flex items-center p-3 hover:bg-gray-50 rounded-2xl transition-colors cursor-pointer border border-transparent hover:border-gray-100">
                    <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-xs font-bold text-red-500 mr-3">
                      {p.student_name ? p.student_name[0] : '?'}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800 text-sm">{p.student_name} <span className="text-gray-400 font-normal">({p.student_id})</span></h4>
                      <p className="text-xs text-red-400 font-bold">{p.symptom}</p>
                    </div>
                    <button onClick={() => handleDeletePatient(p.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 p-2 transition">
                      <FaTrash />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Weekly Returnees List */}
            <div className="bg-white p-6 rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-50">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-orange-50 p-2 rounded-xl text-orange-500"><FaHome /></div>
                  <h3 className="font-bold text-gray-800">금주 귀가자 명단</h3>
                </div>
                <span className="text-xs text-orange-500 font-bold bg-orange-50 px-2 py-1 rounded-full">{weeklyReturnees.length}명</span>
              </div>

              {weeklyReturnees.length > 0 && (
                <div className="flex -space-x-2 overflow-hidden py-2 px-2">
                  {weeklyReturnees.slice(0, 8).map(s => (
                    <div key={s.student_id} className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600" title={s.name}>
                      {s.name[0]} {s.name[1]}
                    </div>
                  ))}
                  {weeklyReturnees.length > 8 && (
                    <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                      +{weeklyReturnees.length - 8}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Nav */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-xl border border-gray-200 shadow-2xl rounded-full px-6 py-3 flex items-center gap-6 z-20">
        <Link href="/admin" className="p-2 text-gray-900 bg-gray-100 rounded-full transition"><FaHome className="text-xl" /></Link>
        <Link href="/admin/students" className="p-2 text-gray-400 hover:text-gray-900 transition"><FaUserFriends className="text-xl" /></Link>
        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg -mt-8 border-4 border-[#FDFDFD] cursor-pointer hover:bg-blue-600 transition">
          <FaPlus />
        </div>
        <Link href="/admin/teachers" className="p-2 text-gray-400 hover:text-gray-900 transition"><FaUserFriends className="text-xl" /></Link>
        <button onClick={() => setShowQR(true)} className="p-2 text-gray-400 hover:text-gray-900 transition"><FaMobileAlt className="text-xl" /></button>
      </div>

      {
        showQR && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in" onClick={() => setShowQR(false)}>
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center relative" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setShowQR(false)}
                className="absolute top-6 right-6 text-gray-300 hover:text-gray-600 text-2xl font-bold"
              >
                &times;
              </button>

              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl text-blue-500">
                <FaMobileAlt />
              </div>

              <h3 className="text-2xl font-extrabold text-gray-800 mb-2">이석찬 앱 설치</h3>
              <p className="text-gray-500 mb-8 text-sm">
                카메라로 스캔하여 설치하세요.
              </p>

              <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-inner inline-block mb-6">
                {origin && <QRCodeSVG value={origin} size={180} level={"H"} includeMargin={true} />}
              </div>

              <button
                onClick={() => setShowQR(false)}
                className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl hover:bg-black transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        )
      }
    </div>
  );
}
