"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/supabaseClient";
import toast, { Toaster } from 'react-hot-toast';
import {
    FaWrench,
    FaFirstAid, FaHome, FaPlus, FaTrash, FaBell, FaCheck, FaUsers,
    FaDoorOpen, FaClock, FaBroom, FaUtensils, FaBoxOpen, FaSignOutAlt, FaChartBar
} from "react-icons/fa";
import { MorningCheckoutModal } from '@/components/room/MorningCheckoutModal';
import { ViolationStatsModal } from '@/components/admin/ViolationStatsModal';

// Types
interface DashboardStats {
    totalStudents: number;
    totalTeachers: number;
    studentsByGrade: { grade: number; count: number; overnight: number; current: number }[];
    studentsByFloor: { floor: number; capacity: number; assigned: number; current: number; overnight: number }[];
    currentLeaves: { overnight: number; short: number };
    violationCount: number;
    violationList: { id: number; student_id: string; student_name: string; checked_at: string; note: string }[];
}

interface MonthlyApplication {
    student_id: string;
    target_year: number;
    target_month: number;
    is_weekly: boolean;
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

const isWeeklyReturnPeriod = (date: Date) => {
    const day = date.getDay();
    const timeValue = date.getHours() * 100 + date.getMinutes();
    if (day === 5) return timeValue >= 1530;
    if (day === 6) return true;
    if (day === 0) return timeValue <= 1850;
    return false;
};

export default function DashboardMain() {
    const [stats, setStats] = useState<DashboardStats>({
        totalStudents: 0,
        totalTeachers: 0,
        studentsByGrade: [],
        studentsByFloor: [],
        currentLeaves: { overnight: 0, short: 0 },
        violationCount: 0,
        violationList: []
    });

    const [weeklyReturnees, setWeeklyReturnees] = useState<WeeklyReturnee[]>([]);
    const [nextMonthApps, setNextMonthApps] = useState<MonthlyApplication[]>([]);
    const [viewMonthMode, setViewMonthMode] = useState<'current' | 'next'>('current');
    const [facilityRequests, setFacilityRequests] = useState<FacilityRequest[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);

    // Date State
    const [selectedDate, setSelectedDate] = useState(new Date());

    const [isLoading, setIsLoading] = useState(true);
    const dateInputRef = useRef<HTMLInputElement>(null);

    // Form States
    const [newFacility, setNewFacility] = useState({ title: '', room: '' });
    const [newPatient, setNewPatient] = useState({ studentId: '', symptom: '' });

    // Student Search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [showSearch, setShowSearch] = useState(false);

    // Modals
    const [isMorningModalOpen, setIsMorningModalOpen] = useState(false);
    const [isViolationStatsOpen, setIsViolationStatsOpen] = useState(false);
    const [isWeeklyListModalOpen, setIsWeeklyListModalOpen] = useState(false);
    const [violationModal, setViolationModal] = useState<{ grade: number, classNum: number } | null>(null);

    // Refresh Trigger for Realtime
    const [refreshKey, setRefreshKey] = useState(0);
    const [allRawStudents, setAllRawStudents] = useState<any[]>([]);

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    };

    const isToday = (d: Date) => {
        const today = new Date();
        return isSameDay(d, today);
    }

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

    const fetchDashboardData = async () => {
        try {
            const now = new Date();
            const startOfDay = new Date(selectedDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(selectedDate);
            endOfDay.setHours(23, 59, 59, 999);

            const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const targetYear = nextMonthDate.getFullYear();
            const targetMonth = nextMonthDate.getMonth() + 1;

            // Parallel Data Fetching
            const [
                studentsRes,
                teachersRes,
                leavesRes,
                violationsRes,
                roomsRes,
                seatsRes,
                nextMonthAppsRes
            ] = await Promise.all([
                supabase.from("students").select("*"),
                supabase.from("teachers").select("*", { count: "exact", head: true }),
                supabase.from("leave_requests")
                    .select("student_id, leave_type, start_time, end_time")
                    .eq("status", "승인")
                    .lte("start_time", endOfDay.toISOString())
                    .gte("end_time", startOfDay.toISOString()),
                supabase.from('morning_checks')
                    .select('id, student_id, checked_at, note')
                    .eq('type', 'late')
                    .gte('checked_at', startOfDay.toISOString())
                    .lte('checked_at', endOfDay.toISOString()),
                supabase.from("room_layouts").select("room_number, total_seats"),
                supabase.from("seat_assignments").select("room_number, student_id"),
                supabase.from("monthly_return_applications")
                    .select("*")
                    .eq("target_year", targetYear)
                    .eq("target_month", targetMonth)
            ]);

            // --- Process 1: Students & Weekly Returnees ---
            const rawStudents = studentsRes.data || [];
            const students = rawStudents.filter((s: any) => !(s.grade === 3 && s.class === 3 && s.number === 17 && s.name === '홍길동'));
            const totalStudents = students.length;

            const weekly = students.filter((s: any) => s.weekend).sort((a: any, b: any) => {
                if (a.grade !== b.grade) return a.grade - b.grade;
                if (a.class !== b.class) return a.class - b.class;
                return a.number - b.number;
            });
            setWeeklyReturnees(weekly);
            setNextMonthApps(nextMonthAppsRes.data || []);
            setAllRawStudents(students);

            // --- Process 2: Leaves ---
            const activeLeaves = leavesRes.data || [];
            const isTodayDate = isSameDay(now, selectedDate);
            const isWeeklyReturnTime = isWeeklyReturnPeriod(isTodayDate ? now : selectedDate);

            const combinedOvernightIds = new Set<string>();
            activeLeaves.forEach((l: any) => {
                if (l.leave_type === '외박') {
                    if (isTodayDate) {
                        const start = new Date(l.start_time);
                        const end = new Date(l.end_time);
                        if (now >= start && now <= end) combinedOvernightIds.add(l.student_id);
                    } else {
                        combinedOvernightIds.add(l.student_id);
                    }
                }
            });
            if (isWeeklyReturnTime) {
                weekly.forEach((s: any) => combinedOvernightIds.add(s.student_id));
            }

            const overnight = combinedOvernightIds.size;
            const short = new Set(activeLeaves.filter((l: any) => l.leave_type === '외출').map((l: any) => l.student_id)).size;

            const countLeaves = (subsetStudents: any[], type?: '외박' | '외출') => {
                const subsetIds = new Set(subsetStudents.map((s: any) => s.student_id));
                if (type === '외박') {
                    let count = 0;
                    combinedOvernightIds.forEach(id => { if (subsetIds.has(id)) count++; });
                    return count;
                }
                const relevantLeaves = activeLeaves.filter((l: any) => {
                    if (!subsetIds.has(l.student_id)) return false;
                    if (type) return l.leave_type === type;
                    return true;
                });
                return new Set(relevantLeaves.map((l: any) => l.student_id)).size;
            };

            // --- Process 3: Grade Stats ---
            const gradeStats = [1, 2, 3].map(g => {
                const gradeStudents = students.filter((s: any) => s.grade === g);
                const total = gradeStudents.length;
                const overnightCount = countLeaves(gradeStudents, '외박');
                return {
                    grade: g,
                    count: total,
                    overnight: overnightCount,
                    current: Math.max(0, total - overnightCount)
                };
            });

            // --- Process 4: Floor Stats ---
            const floorStats = [1, 2, 3, 4].map(floor => {
                const floorStudents = students.filter((s: any) =>
                    s.room_number >= floor * 100 && s.room_number < (floor + 1) * 100
                );
                const assignedCount = floorStudents.length;
                const floorStudentIds = new Set(floorStudents.map((s: any) => s.student_id));
                let floorOvernightCount = 0;
                combinedOvernightIds.forEach(id => { if (floorStudentIds.has(id)) floorOvernightCount++; });
                return {
                    floor,
                    capacity: assignedCount,
                    assigned: assignedCount,
                    current: Math.max(0, assignedCount - floorOvernightCount),
                    overnight: floorOvernightCount
                };
            });

            // --- Process 5: Violations ---
            const violations = violationsRes.data || [];
            let violationList: any[] = [];

            if (violations.length > 0) {
                const studentMap = new Map();
                students.forEach((s: any) => studentMap.set(s.student_id, s.name));

                violationList = violations.map((v: any) => ({
                    id: v.id,
                    student_id: v.student_id,
                    student_name: studentMap.get(v.student_id) || v.student_id,
                    checked_at: v.checked_at,
                    note: v.note || '일과시간 미준수'
                }));
            }

            setStats({
                totalStudents: totalStudents || 0,
                totalTeachers: teachersRes.count || 0,
                studentsByGrade: gradeStats,
                studentsByFloor: floorStats,
                currentLeaves: { overnight: overnight, short: short },
                violationCount: violations.length,
                violationList
            });

            fetchFacilityData();
            fetchPatientData();

        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
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
            supabase.channel('admin_dash_facility').on('postgres_changes', { event: '*', schema: 'public', table: 'facility_requests' }, () => fetchFacilityData()),
            supabase.channel('admin_dash_patients').on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, () => fetchPatientData()),
            supabase.channel('admin_dash_rooms').on('postgres_changes', { event: '*', schema: 'public', table: 'room_layouts' }, handleRealtimeUpdate),
            supabase.channel('admin_dash_violations').on('postgres_changes', { event: '*', schema: 'public', table: 'morning_checks' }, handleRealtimeUpdate),
        ];

        channels.forEach(c => c.subscribe());

        return () => {
            channels.forEach(c => supabase.removeChannel(c));
        };
    }, []);

    // --- Search Handler ---
    useEffect(() => {
        const searchStudents = async () => {
            if (searchQuery.length < 1) {
                setSearchResults([]);
                return;
            }

            const { data } = await supabase
                .from('students')
                .select('student_id, name')
                .or(`name.ilike.%${searchQuery}%,student_id.ilike.%${searchQuery}%`)
                .limit(5);

            setSearchResults(data || []);
        };

        const debounce = setTimeout(() => searchStudents(), 300);
        return () => clearTimeout(debounce);
    }, [searchQuery]);

    // --- Handlers ---
    const handleCreateFacility = async () => {
        if (!newFacility.title) return toast.error("제목을 입력하세요");

        let parsedRoom = newFacility.room ? parseInt(newFacility.room) : null;
        if (!parsedRoom) {
            const match = newFacility.title.match(/(\d{3})/);
            if (match) parsedRoom = parseInt(match[1]);
        }

        const { data, error } = await supabase.from("facility_requests").insert({
            title: newFacility.title,
            room_number: parsedRoom,
            status: '대기'
        }).select().single();

        if (error) return toast.error("등록 실패");
        if (data) setFacilityRequests(prev => [data, ...prev]);

        setNewFacility({ title: '', room: '' });
        toast.success("등록되었습니다");
    };

    const handleDeleteFacility = async (id: number) => {
        if (!confirm("삭제하시겠습니까?")) return;
        setFacilityRequests(prev => prev.filter(item => item.id !== id));
        const { error } = await supabase.from("facility_requests").delete().eq("id", id);
        if (error) {
            toast.error("삭제 실패");
            fetchFacilityData();
        } else {
            toast.success("삭제되었습니다");
        }
    };

    const handleToggleFacilityStatus = async (id: number, currentStatus: string) => {
        const newStatus = currentStatus === '완료' ? '대기' : '완료';
        setFacilityRequests(prev => prev.map(item => item.id === id ? { ...item, status: newStatus } : item));
        const { error } = await supabase.from("facility_requests").update({ status: newStatus }).eq("id", id);
        if (error) {
            toast.error("상태 변경 실패");
            fetchFacilityData();
        } else {
            toast.success(`상태가 ${newStatus}로 변경되었습니다`);
        }
    }

    const handleCreatePatient = async (selectedStudent?: any) => {
        const targetId = selectedStudent?.student_id || newPatient.studentId;
        if (!targetId || !newPatient.symptom) return toast.error("정보를 입력하세요");

        const tempId = Date.now();
        const optimisitcPatient = {
            id: tempId,
            student_id: targetId,
            symptom: newPatient.symptom,
            status: '기숙사',
            created_at: new Date().toISOString(),
            student_name: selectedStudent?.name || targetId,
            note: ''
        };

        setPatients(prev => [optimisitcPatient, ...prev]);
        setNewPatient({ studentId: '', symptom: '' });
        setSearchQuery('');
        setShowSearch(false);

        const { data, error } = await supabase.from("patients").insert({
            student_id: targetId,
            symptom: newPatient.symptom,
            status: '기숙사'
        }).select().single();

        if (error) {
            toast.error("등록 실패");
            setPatients(prev => prev.filter(p => p.id !== tempId));
            return;
        }

        if (data) {
            setPatients(prev => prev.map(p => p.id === tempId ? { ...p, id: data.id, student_name: optimisitcPatient.student_name } : p));
            toast.success("등록되었습니다");
        }
    };

    const handleDeletePatient = async (id: number) => {
        if (!confirm("삭제하시겠습니까? (완치)")) return;
        setPatients(prev => prev.filter(p => p.id !== id));
        const { error } = await supabase.from("patients").delete().eq("id", id);
        if (error) {
            toast.error("삭제 실패");
            fetchPatientData();
        } else {
            toast.success("삭제되었습니다");
        }
    };

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
            <div className="sticky top-0 bg-[#FDFDFD]/80 backdrop-blur-xl z-40 border-b border-gray-100/50 transition-all">
                <div className="px-6 py-4 max-w-xl mx-auto md:max-w-4xl flex items-center justify-between">
                    <div
                        className="relative group cursor-pointer"
                        onClick={() => dateInputRef.current?.showPicker()}
                    >
                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-200 group-hover:bg-gray-50 transition-all active:scale-95">
                            <FaClock className="text-gray-400 text-sm" />
                            <span className="font-bold text-sm text-gray-800 tracking-tight">{dateString}</span>
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse ml-1"></div>
                        </div>
                        <input
                            ref={dateInputRef}
                            id="date-picker-input"
                            type="date"
                            required
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            onChange={(e) => {
                                if (e.target.value) setSelectedDate(new Date(e.target.value));
                            }}
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => window.location.href = '/teacher'}
                            className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-yellow-400/50 text-yellow-600 hover:bg-yellow-50 transition-all active:scale-95 text-xs font-bold"
                        >
                            <span>⬅</span>
                            <span>교사 페이지</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="px-6 space-y-6 max-w-xl mx-auto md:max-w-4xl mt-4">

                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                            <div className="p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500">
                                <div className="p-[2px] bg-white rounded-full">
                                    <img src="/dorm.jpg" alt="Profile" className="w-12 h-12 rounded-full object-cover" />
                                </div>
                            </div>
                            <span className="text-gray-900">오늘의 홍지관</span>
                        </h2>
                    </div>

                    {/* Total Summary */}
                    <div className="bg-gray-900 text-white p-3 rounded-2xl shadow-sm flex justify-center items-center px-4">
                        <div className="flex flex-wrap justify-center gap-3 md:gap-6 text-xs md:text-sm font-bold whitespace-nowrap">
                            <span>정원 : {stats.totalStudents}명</span>
                            <span className="text-red-400">외박자 : {stats.currentLeaves.overnight}명</span>
                            <span>현재원 : {stats.studentsByGrade.reduce((acc, curr) => acc + curr.current, 0)}명</span>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="flex w-full items-stretch justify-between gap-1 mb-4">
                        {stats.studentsByGrade.map(g => (
                            <div key={`g-${g.grade}`} className="flex-1 bg-white py-2 rounded-[1rem] border border-gray-100 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)] flex flex-col items-center justify-between gap-1 hover:bg-gray-50 transition-colors cursor-pointer group min-w-0">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold border ${g.grade === 1 ? 'bg-blue-50 text-blue-500 border-blue-100' :
                                    g.grade === 2 ? 'bg-purple-50 text-purple-500 border-purple-100' :
                                        'bg-orange-50 text-orange-500 border-orange-100'
                                    }`}>
                                    {g.grade}
                                </div>
                                <div className="flex flex-col items-center gap-0.5 text-center w-full">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-gray-400 font-medium transform scale-90">총원</span>
                                        <strong className="text-xs text-gray-800 leading-none">{g.count}</strong>
                                    </div>
                                    <div className="w-4 h-px bg-gray-100 my-0.5"></div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-gray-400 font-medium transform scale-90">외박</span>
                                        <strong className="text-xs text-red-500 leading-none">{g.overnight}</strong>
                                    </div>
                                    <div className="w-4 h-px bg-gray-100 my-0.5"></div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-gray-400 font-medium transform scale-90">현재</span>
                                        <strong className="text-xs text-blue-600 leading-none">{g.current}</strong>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div className="w-px bg-gray-200 mx-0.5 my-2"></div>
                        {stats.studentsByFloor.map(f => (
                            <div key={`f-${f.floor}`} className="flex-1 bg-white py-2 rounded-[1rem] border border-gray-100 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)] flex flex-col items-center justify-between gap-1 hover:bg-gray-50 transition-colors cursor-pointer group min-w-0">
                                <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center text-[10px] font-bold text-indigo-500 border border-indigo-100">
                                    {f.floor}F
                                </div>
                                <div className="flex flex-col items-center gap-0.5 text-center w-full">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-gray-400 font-medium transform scale-90">정원</span>
                                        <strong className="text-xs text-gray-800 leading-none">{f.capacity}</strong>
                                    </div>
                                    <div className="w-4 h-px bg-gray-100 my-0.5"></div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-gray-400 font-medium transform scale-90">외박</span>
                                        <strong className="text-xs text-red-500 leading-none">{f.overnight}</strong>
                                    </div>
                                    <div className="w-4 h-px bg-gray-100 my-0.5"></div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-gray-400 font-medium transform scale-90">현재</span>
                                        <strong className="text-xs text-indigo-600 leading-none">{f.current}</strong>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Monthly Returnee Status */}
                    <div className="bg-white p-6 rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-50 mb-4">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-3">
                                <div className="bg-orange-50 p-2 rounded-xl text-orange-500"><FaHome /></div>
                                <h3 className="font-bold text-gray-800 text-[12px]">이번달 매주귀가자 현황</h3>
                            </div>
                            <button
                                onClick={() => setIsWeeklyListModalOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-[10px] font-bold"
                            >
                                <FaUsers size={12} />
                                귀가자 명단
                            </button>
                        </div>

                        <div className="space-y-1">
                            {[1, 2, 3].map(grade => {
                                const gradeInfo = stats.studentsByGrade.find(g => g.grade === grade);
                                const gradeTotal = gradeInfo?.count || 0;
                                const gradeWeekly = weeklyReturnees.filter(s => s.grade === grade).length;
                                const gradeDorm = gradeTotal - gradeWeekly;

                                return (
                                    <div key={grade} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[12px] ${grade === 1 ? 'bg-blue-100 text-blue-600' :
                                                grade === 2 ? 'bg-purple-100 text-purple-600' :
                                                    'bg-orange-100 text-orange-600'
                                                }`}>
                                                {grade}
                                            </div>
                                            <span className="font-bold text-gray-700 text-[12px]">{grade}학년</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[12px] font-medium">
                                            <div className="flex flex-col items-center min-w-[30px]">
                                                <span className="text-[12px] text-gray-400 mb-0.5">총원</span>
                                                <span className="text-gray-800 font-bold text-[12px]">{gradeTotal}</span>
                                            </div>
                                            <div className="w-px h-6 bg-gray-200"></div>
                                            <div className="flex flex-col items-center min-w-[30px]">
                                                <span className="text-[12px] text-gray-400 mb-0.5">매주귀가</span>
                                                <span className="text-orange-500 font-bold text-[12px]">{gradeWeekly}</span>
                                            </div>
                                            <div className="w-px h-6 bg-gray-200"></div>
                                            <div className="flex flex-col items-center min-w-[30px]">
                                                <span className="text-[12px] text-gray-400 mb-0.5">기숙</span>
                                                <span className="text-blue-500 font-bold text-[12px]">{gradeDorm}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            <div className="flex items-center justify-between p-3 bg-gray-900 rounded-2xl shadow-sm mt-1">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[12px] bg-gray-700 text-white">
                                        ALL
                                    </div>
                                    <span className="font-bold text-white text-[12px]">전학년</span>
                                </div>
                                <div className="flex items-center gap-3 text-[12px] font-medium text-white">
                                    <div className="flex flex-col items-center min-w-[30px]">
                                        <span className="text-[12px] text-gray-400 mb-0.5">총원</span>
                                        <span className="font-bold text-[12px]">{stats.totalStudents}</span>
                                    </div>
                                    <div className="w-px h-6 bg-gray-700"></div>
                                    <div className="flex flex-col items-center min-w-[30px]">
                                        <span className="text-[12px] text-gray-400 mb-0.5">매주귀가</span>
                                        <span className="text-orange-400 font-bold text-[12px]">{weeklyReturnees.length}</span>
                                    </div>
                                    <div className="w-px h-6 bg-gray-700"></div>
                                    <div className="flex flex-col items-center min-w-[30px]">
                                        <span className="text-[12px] text-gray-400 mb-0.5">기숙</span>
                                        <span className="text-blue-400 font-bold text-[12px]">{stats.totalStudents - weeklyReturnees.length}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Violation Counter & List */}
                    <div className="bg-rose-50/60 p-3 rounded-2xl border border-rose-100 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center p-1.5 shadow-sm">
                                    <img src="/yellow_card.svg" className="w-full h-full object-contain" alt="Yellow Card" />
                                </div>
                                <span className="font-bold text-rose-900 text-[12px]">생활지도 위반자</span>
                            </div>
                            <span className="text-[12px] font-bold text-rose-600">{stats.violationCount}명</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-rose-100/50">
                            {[1, 2, 3].map(grade => (
                                [1, 2, 3].map(classNum => {
                                    const classViolations = stats.violationList.filter(v => v.student_id.startsWith(`${grade}${classNum}`));
                                    const hasViolations = classViolations.length > 0;

                                    return (
                                        <button
                                            key={`${grade}-${classNum}`}
                                            onClick={() => setViolationModal({ grade, classNum })}
                                            className={`
                        py-2.5 rounded-xl text-[12px] font-bold transition-all flex items-center justify-center gap-1.5 border
                        ${hasViolations
                                                    ? 'bg-rose-100 text-rose-600 border-rose-200 shadow-sm'
                                                    : 'bg-white text-gray-400 border-gray-100 hover:border-rose-200 hover:text-rose-400'}
                      `}
                                        >
                                            <span>{grade}-{classNum}</span>
                                            {hasViolations && (
                                                <span className="bg-rose-200 text-rose-700 px-1.5 py-0.5 rounded text-[12px] leading-none">{classViolations.length}</span>
                                            )}
                                        </button>
                                    );
                                })
                            ))}
                        </div>
                    </div>

                    {violationModal && (
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={() => setViolationModal(null)}>
                            <div className="bg-white w-full max-w-[300px] rounded-[1.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                                <div className="bg-rose-500 px-5 py-4 text-white flex justify-between items-center">
                                    <h3 className="font-bold text-base">{violationModal.grade}학년 {violationModal.classNum}반 위반자 ({stats.violationList.filter(v => v.student_id.startsWith(`${violationModal.grade}${violationModal.classNum}`)).length}명)</h3>
                                    <button onClick={() => setViolationModal(null)} className="opacity-80 hover:opacity-100 p-1">✕</button>
                                </div>
                                <div className="p-4 max-h-[50vh] overflow-y-auto">
                                    {stats.violationList.filter(v => v.student_id.startsWith(`${violationModal.grade}${violationModal.classNum}`)).length === 0 ? (
                                        <p className="text-gray-400 text-center text-xs py-4">미준수자가 없습니다.</p>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            {stats.violationList
                                                .filter(v => v.student_id.startsWith(`${violationModal.grade}${violationModal.classNum}`))
                                                .map((v, vIdx) => (
                                                    <div key={v.id || `violation-${vIdx}`} className="flex items-center justify-between bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${v.note === '스토퍼 미설치' ? 'bg-amber-100 text-amber-600' :
                                                                v.note === '일과시간 미준수' ? 'bg-orange-100 text-orange-600' :
                                                                    v.note === '청소불량' ? 'bg-green-100 text-green-600' :
                                                                        v.note === '음식물 섭취 위반' ? 'bg-red-100 text-red-600' :
                                                                            v.note === '퇴실수칙 불이행' ? 'bg-purple-100 text-purple-600' :
                                                                                'bg-blue-100 text-blue-600'
                                                                }`}>
                                                                {v.note === '스토퍼 미설치' && <FaDoorOpen size={14} />}
                                                                {v.note === '일과시간 미준수' && <FaClock size={14} />}
                                                                {v.note === '청소불량' && <FaBroom size={14} />}
                                                                {v.note === '음식물 섭취 위반' && <FaUtensils size={14} />}
                                                                {v.note === '박스 방치' && <FaBoxOpen size={14} />}
                                                                {v.note === '퇴실수칙 불이행' && <FaSignOutAlt size={14} />}
                                                            </div>
                                                            <div>
                                                                <span className="text-sm font-bold text-gray-800 block">{v.student_id} {v.student_name}</span>
                                                                <span className="text-[11px] font-medium text-gray-500">{v.note}</span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={async () => {
                                                                if (!confirm('삭제하시겠습니까?')) return;

                                                                const originalStats = { ...stats };
                                                                setStats(prev => ({
                                                                    ...prev,
                                                                    violationCount: prev.violationCount - 1,
                                                                    violationList: prev.violationList.filter(item => item.id !== v.id)
                                                                }));

                                                                const { error } = await supabase.from('morning_checks').delete().eq('id', v.id);

                                                                if (error) {
                                                                    console.error('[Dashboard] Delete Error:', error);
                                                                    toast.error('삭제 실패 (DB 권한 확인 필요)');
                                                                    setStats(originalStats);
                                                                } else {
                                                                    toast.success('삭제됨');
                                                                }
                                                            }}
                                                            className="w-7 h-7 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-colors flex-shrink-0 ml-2"
                                                        >
                                                            <FaTrash size={10} />
                                                        </button>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => setIsViolationStatsOpen(true)}
                        className="w-full mt-3 py-3 rounded-xl text-sm font-bold transition-all text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 shadow-sm text-center flex items-center justify-center gap-2"
                    >
                        <FaChartBar size={14} />
                        위반 학생 통계 (월별)
                    </button>
                </div>

                {/* Section 2: Tasks List */}
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <h2 className="text-lg font-bold text-gray-800">홍지관/양현재</h2>
                        <span className="bg-white px-2 py-0.5 rounded-full text-xs font-bold text-gray-500 border border-gray-100 shadow-sm">
                            {filteredFacility.length + filteredPatients.length}
                        </span>
                    </div>

                    <div className="space-y-0.5">
                        {/* Facility Card */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-50">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-50 p-2 rounded-xl text-blue-500"><FaWrench /></div>
                                    <h3 className="font-bold text-gray-800 text-[12px]">시설물 수리 요청</h3>
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

                            <div className="space-y-0.5">
                                {filteredFacility.length === 0 ? (
                                    <div className="text-center py-4 text-gray-300 text-sm">요청 내역이 없습니다</div>
                                ) : filteredFacility.map((req, reqIdx) => (
                                    <div key={req.id || `facility-${reqIdx}`} className="group flex items-center py-1.5 px-3 hover:bg-gray-50 rounded-2xl transition-colors cursor-pointer border border-transparent hover:border-gray-100">
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
                                            <h4 className={`font-bold text-[12px] transition-colors ${req.status === '완료' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{req.title}</h4>
                                            <p className="text-[12px] text-gray-400">
                                                {req.room_number ? `${req.room_number}호` : '공용'} • {req.created_at.substring(5, 10)}
                                            </p>
                                        </div>
                                        <button onClick={() => handleDeleteFacility(req.id)} className="text-gray-300 hover:text-red-500 p-2 transition">
                                            <FaTrash size={10} />
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
                                    <h3 className="font-bold text-gray-800 text-[12px]">환자 관리 (보건실)</h3>
                                </div>
                            </div>

                            <div className="mb-4 flex gap-2 items-start relative">
                                <div className="relative w-32">
                                    <input
                                        type="text"
                                        className="bg-gray-50 border-none rounded-xl px-4 py-3 text-sm w-full outline-none focus:bg-gray-100"
                                        placeholder="이름/학번"
                                        value={searchQuery}
                                        onFocus={() => setShowSearch(true)}
                                        onBlur={() => setTimeout(() => setShowSearch(false), 200)}
                                        onChange={e => {
                                            setSearchQuery(e.target.value);
                                            setShowSearch(true);
                                        }}
                                    />
                                    {showSearch && searchResults.length > 0 && (
                                        <div className="absolute top-full left-0 w-48 bg-white border border-gray-100 shadow-xl rounded-xl mt-2 z-50 overflow-hidden">
                                            {searchResults.map((s, sIdx) => (
                                                <div
                                                    key={s.student_id || `search-result-${sIdx}`}
                                                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between group"
                                                    onClick={() => {
                                                        setNewPatient({ ...newPatient, studentId: s.student_id });
                                                        setSearchQuery(s.name);
                                                        setShowSearch(false);
                                                        document.getElementById('patient-symptom-input')?.focus();
                                                    }}
                                                >
                                                    <span className="text-sm font-bold text-gray-800">{s.name}</span>
                                                    <span className="text-xs text-gray-400 group-hover:text-blue-500">{s.student_id}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <input
                                    id="patient-symptom-input"
                                    type="text"
                                    className="bg-gray-50 border-none rounded-xl px-4 py-3 text-sm flex-1 outline-none focus:bg-gray-100"
                                    placeholder="증상"
                                    value={newPatient.symptom}
                                    onChange={e => setNewPatient({ ...newPatient, symptom: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleCreatePatient(searchResults.find(s => s.name === searchQuery || s.student_id === searchQuery));
                                    }}
                                />
                                <button
                                    onClick={() => handleCreatePatient(searchResults.find(s => s.name === searchQuery || s.student_id === searchQuery))}
                                    className="bg-red-500 text-white w-12 h-[44px] rounded-xl flex items-center justify-center hover:bg-red-600 active:scale-95 transition flex-shrink-0"
                                >
                                    <FaPlus />
                                </button>
                            </div>

                            <div className="space-y-0.5">
                                {filteredPatients.length === 0 ? (
                                    <div className="text-center py-4 text-gray-300 text-sm">환자가 없습니다</div>
                                ) : filteredPatients.map((p, pIdx) => (
                                    <div key={p.id || `patient-${pIdx}`} className="group flex items-center py-1.5 px-3 hover:bg-gray-50 rounded-2xl transition-colors cursor-pointer border border-transparent hover:border-gray-100">
                                        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-[12px] font-bold text-red-500 mr-3">
                                            {p.student_name ? p.student_name[0] : '?'}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-gray-800 text-[12px]">{p.student_name} <span className="text-gray-400 font-normal">({p.student_id})</span></h4>
                                            <p className="text-[12px] text-red-400 font-bold">{p.symptom}</p>
                                        </div>
                                        <button onClick={() => handleDeletePatient(p.id)} className="text-gray-300 hover:text-red-500 p-2 transition">
                                            <FaTrash size={10} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <MorningCheckoutModal
                key="main-morning-checkout-modal"
                isOpen={isMorningModalOpen}
                onClose={() => setIsMorningModalOpen(false)}
            />

            <ViolationStatsModal
                key="main-violation-stats-modal"
                isOpen={isViolationStatsOpen}
                onClose={() => setIsViolationStatsOpen(false)}
            />

            {isWeeklyListModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={() => setIsWeeklyListModalOpen(false)}>
                    <div className="bg-white w-full max-w-[340px] rounded-[1.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="bg-blue-700 px-5 py-3 text-white">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-base">귀가자 명단</h3>
                                <div className="flex items-center gap-2">
                                    <span className="bg-white/20 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                                        {viewMonthMode === 'current' ? weeklyReturnees.length : allRawStudents.filter(s => {
                                            const app = nextMonthApps.find(a => a.student_id === s.student_id);
                                            return app ? app.is_weekly : !!s.weekend;
                                        }).length}명
                                    </span>
                                    <button onClick={() => setIsWeeklyListModalOpen(false)} className="opacity-80 hover:opacity-100 p-1">✕</button>
                                </div>
                            </div>
                            <div className="flex bg-white/10 p-1 rounded-xl text-[11px] font-bold">
                                <button
                                    onClick={() => setViewMonthMode('current')}
                                    className={`flex-1 py-1.5 rounded-lg transition-all ${viewMonthMode === 'current' ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-100'}`}
                                >
                                    {new Date().getMonth() + 1}월 현재
                                </button>
                                <button
                                    onClick={() => setViewMonthMode('next')}
                                    className={`flex-1 py-1.5 rounded-lg transition-all ${viewMonthMode === 'next' ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-100'}`}
                                >
                                    {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).getMonth() + 1}월 예정
                                </button>
                            </div>
                        </div>
                        <div className="p-4 max-h-[50vh] overflow-y-auto overflow-x-hidden">
                            {viewMonthMode === 'current' ? (
                                weeklyReturnees.length === 0 ? (
                                    <p className="text-gray-400 text-center text-xs py-4">매주귀가자가 없습니다.</p>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        {[...weeklyReturnees]
                                            .sort((a, b) => a.student_id.localeCompare(b.student_id))
                                            .map((s) => (
                                                <div key={s.student_id} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold text-blue-600 leading-none mb-0.5">{s.student_id}</span>
                                                        <span className="text-xs font-bold text-gray-800">{s.name}</span>
                                                    </div>
                                                </div>
                                            ))
                                        }
                                    </div>
                                )
                            ) : (() => {
                                const nextList = allRawStudents.filter(s => {
                                    const app = nextMonthApps.find(a => a.student_id === s.student_id);
                                    return app ? app.is_weekly : !!s.weekend;
                                }).sort((a, b) => a.student_id.localeCompare(b.student_id));

                                if (nextList.length === 0) return <p className="text-gray-400 text-center text-xs py-4">매주귀가자가 없습니다.</p>;

                                return (
                                    <div className="grid grid-cols-2 gap-2">
                                        {nextList.map((s) => {
                                            const app = nextMonthApps.find(a => a.student_id === s.student_id);
                                            const isChanging = app !== undefined && !!app.is_weekly !== !!s.weekend;
                                            return (
                                                <div key={s.student_id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${isChanging ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'}`}>
                                                    <div className="flex-1 flex flex-col">
                                                        <span className="text-[10px] font-bold text-blue-600 leading-none mb-0.5">{s.student_id}</span>
                                                        <span className="text-xs font-bold text-gray-800">{s.name}</span>
                                                    </div>
                                                    {isChanging && (
                                                        <span className="text-[9px] font-black text-blue-600 bg-white px-1 py-0.5 rounded shadow-sm">신규</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-100">
                            <button
                                onClick={() => setIsWeeklyListModalOpen(false)}
                                className="w-full py-2.5 bg-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-300 transition-colors"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
