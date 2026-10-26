"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/supabaseClient";
import toast, { Toaster } from 'react-hot-toast';
import {
    FaWrench,
    FaFirstAid, FaHome, FaPlus, FaTrash, FaBell, FaCheck, FaUsers,
    FaClock, FaChartBar,
    FaShareAlt, FaPrint
} from "react-icons/fa";
import { HiHome } from 'react-icons/hi';
import { MorningCheckoutModal } from '@/components/room/MorningCheckoutModal';
import { ViolationStatsModal } from '@/components/admin/ViolationStatsModal';
import { FacilityStatsModal } from '@/components/admin/FacilityStatsModal';
import { PatientStatsModal } from '@/components/admin/PatientStatsModal';
import { YanghyeonjaeStatsModal } from '@/components/admin/YanghyeonjaeStatsModal';
import { LeaveProcessCard } from '@/components/teacher/LeaveProcessCard';
import { LeaveRequest } from '@/components/teacher/types';
import { isWeeklyHomeTime as isWeeklyReturnPeriod } from '@/lib/weeklyReturn';
import { getKSTDateString, generateDailyToken } from '@/lib/dailyToken';

// Types
interface DashboardStats {
    totalStudents: number;
    totalTeachers: number;
    studentsByGrade: {
        grade: number;
        count: number;
        overnight: number;
        short: number;
        current: number;
        femaleCount?: number;
        femaleOvernight?: number;
        femaleShort?: number;
        femaleCurrent?: number;
        maleCount?: number;
        maleOvernight?: number;
        maleShort?: number;
        maleCurrent?: number;
    }[];
    studentsByFloor: { floor: number; capacity: number; assigned: number; overnight: number; short: number; current: number }[];
    unassignedCount?: number;
    currentLeaves: { overnight: number; short: number };
    violationCount: number;
    violationList: { id: number | string; student_id: string; student_name: string; checked_at: string; note: string; teacher_id?: string }[];
    yanghyeonjaeCount: number;
    yanghyeonjaeList: { id: number | string; student_id: string; student_name: string; checked_at: string; note: string; teacher_id?: string }[];
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

interface DashboardMainProps {
    readOnly?: boolean;
}

export default function DashboardMain({ readOnly = false }: DashboardMainProps = {}) {
    const router = useRouter();
    const [stats, setStats] = useState<DashboardStats>({
        totalStudents: 0,
        totalTeachers: 0,
        studentsByGrade: [],
        studentsByFloor: [],
        currentLeaves: { overnight: 0, short: 0 },
        violationCount: 0,
        violationList: [],
        yanghyeonjaeCount: 0,
        yanghyeonjaeList: []
    });

    const [weeklyReturnees, setWeeklyReturnees] = useState<WeeklyReturnee[]>([]);
    const [currentMonthApps, setCurrentMonthApps] = useState<MonthlyApplication[]>([]);
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
    const [violationStatsFilter, setViolationStatsFilter] = useState<'today' | 'month'>('month');
    const [isYanghyeonjaeStatsOpen, setIsYanghyeonjaeStatsOpen] = useState(false);
    const [yanghyeonjaeStatsFilter, setYanghyeonjaeStatsFilter] = useState<'today' | 'month'>('month');
    const [isFacilityStatsOpen, setIsFacilityStatsOpen] = useState(false);
    const [isPatientStatsOpen, setIsPatientStatsOpen] = useState(false);
    const [isWeeklyListModalOpen, setIsWeeklyListModalOpen] = useState(false);

    // Refresh Trigger for Realtime
    const [refreshKey, setRefreshKey] = useState(0);
    const [allRawStudents, setAllRawStudents] = useState<any[]>([]);
    const [nextMonthSearchQuery, setNextMonthSearchQuery] = useState('');
    const [currentMonthSearchQuery, setCurrentMonthSearchQuery] = useState('');
    const [showOnlyWeeklyCurrent, setShowOnlyWeeklyCurrent] = useState(false);

    // Overnight / Outing Student List Modal States
    const [allLeaveRequests, setAllLeaveRequests] = useState<any[]>([]);
    const [expandedLeaveId, setExpandedLeaveId] = useState<string | number | null>(null);
    const [overnightStudentIds, setOvernightStudentIds] = useState<string[]>([]);
    const [shortStudentIds, setShortStudentIds] = useState<string[]>([]);
    const [leaveListModal, setLeaveListModal] = useState<{ isOpen: boolean; title: string; type: 'overnight' | 'short'; studentIds: string[] }>({ isOpen: false, title: '', type: 'overnight', studentIds: [] });
    const [leaveModalSearchQuery, setLeaveModalSearchQuery] = useState('');

    // Lock body scroll when leaveListModal is open to prevent background scrolling
    useEffect(() => {
        if (leaveListModal.isOpen) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalOverflow || 'unset';
            };
        }
    }, [leaveListModal.isOpen]);

    const handleToggleNextMonthApp = async (studentId: string, currentIsWeekly: boolean) => {
        const now = new Date();
        const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const targetYear = nextMonthDate.getFullYear();
        const targetMonth = nextMonthDate.getMonth() + 1;

        const student = allRawStudents.find(s => s.student_id === studentId);
        if (!student) return;

        const baseWeekendStatus = !!student.weekend;
        const nextStatus = !currentIsWeekly;

        if (!window.confirm(`${student.name}(${studentId}) 학생의 ${targetMonth}월 귀가 상태를 ${nextStatus ? '매주귀가' : '격주귀가'}(으)로 변경하시겠습니까?`)) {
            return;
        }

        try {
            if (nextStatus === baseWeekendStatus) {
                // 기본값과 같아지면 데이터베이스 레코드 제거
                const { error } = await supabase
                    .from('monthly_return_applications')
                    .delete()
                    .eq('student_id', studentId)
                    .eq('target_year', targetYear)
                    .eq('target_month', targetMonth);

                if (error) throw error;
            } else {
                // 기본값과 달라지면 레코드 업서트
                const { error } = await supabase
                    .from('monthly_return_applications')
                    .upsert({
                        student_id: studentId,
                        target_year: targetYear,
                        target_month: targetMonth,
                        is_weekly: nextStatus
                    }, { onConflict: 'student_id, target_year, target_month' });

                if (error) throw error;
            }

            toast.success(`${student.name} 학생의 ${targetMonth}월 귀가 상태가 ${nextStatus ? '매주귀가' : '격주귀가'}로 변경되었습니다.`);
            
            // 로컬 상태 즉각 갱신
            setNextMonthApps(prev => {
                const filtered = prev.filter(app => !(app.student_id === studentId && app.target_year === targetYear && app.target_month === targetMonth));
                if (nextStatus !== baseWeekendStatus) {
                    return [...filtered, { student_id: studentId, target_year: targetYear, target_month: targetMonth, is_weekly: nextStatus }];
                }
                return filtered;
            });
        } catch (error: any) {
            console.error(error);
            toast.error("변경 중 오류가 발생했습니다: " + error.message);
        }
    };

    const handleToggleCurrentMonthApp = async (studentId: string, currentIsWeekly: boolean) => {
        const student = allRawStudents.find(s => s.student_id === studentId);
        if (!student) return;

        const nextStatus = !currentIsWeekly;

        if (!window.confirm(`${student.name}(${studentId}) 학생의 현재월 귀가 상태를 ${nextStatus ? '매주귀가' : '격주귀가'}(으)로 변경하시겠습니까?`)) {
            return;
        }

        try {
            const now = new Date();
            const curYear = now.getFullYear();
            const curMonth = now.getMonth() + 1;

            // 1. Update students table (baseline)
            const { error: studentError } = await supabase
                .from('students')
                .update({ weekend: nextStatus })
                .eq('student_id', studentId);

            if (studentError) throw studentError;

            // 2. Sync monthly_return_applications for current month
            const { error: monthlyError } = await supabase
                .from('monthly_return_applications')
                .upsert({
                    student_id: studentId,
                    target_year: curYear,
                    target_month: curMonth,
                    is_weekly: nextStatus
                }, { onConflict: 'student_id, target_year, target_month' });

            if (monthlyError) throw monthlyError;

            toast.success(`${student.name} 학생의 현재월 귀가 상태가 ${nextStatus ? '매주귀가' : '격주귀가'}로 변경되었습니다.`);

            setCurrentMonthApps(prev => {
                const filtered = prev.filter(a => a.student_id !== studentId);
                return [...filtered, { student_id: studentId, target_year: curYear, target_month: curMonth, is_weekly: nextStatus }];
            });

            setAllRawStudents(prev => prev.map(s => s.student_id === studentId ? { ...s, weekend: nextStatus } : s));
            setWeeklyReturnees(prev => {
                if (nextStatus) {
                    if (prev.some(s => s.student_id === studentId)) return prev;
                    return [...prev, { ...student, weekend: nextStatus }].sort((a, b) => a.student_id.localeCompare(b.student_id));
                } else {
                    return prev.filter(s => s.student_id !== studentId);
                }
            });
            setRefreshKey(prev => prev + 1);
        } catch (error: any) {
            console.error(error);
            toast.error("변경 중 오류가 발생했습니다: " + error.message);
        }
    };

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    };

    const isToday = (d: Date) => {
        const today = new Date();
        return isSameDay(d, today);
    };

    // 점호 기준 시간 계산 헬퍼 (18:00 ~ 익일 09:00)
    const getRollcallRange = (baseDate: Date) => {
        const now = new Date();
        const isSelectedToday = isSameDay(now, baseDate);
        let start: Date;
        let end: Date;

        if (isSelectedToday) {
            if (now.getHours() < 18) {
                // 새벽/오전/낮(00:00~17:59) 조회 시: 어제 18:00 ~ 오늘 09:00
                start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 18, 0, 0, 0);
                end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);
            } else {
                // 저녁/야간(18:00~23:59) 조회 시: 오늘 18:00 ~ 내일 09:00
                start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0, 0);
                end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0, 0);
            }
        } else {
            // 특정 과거/미래 날짜 조회 시: 해당일 18:00 ~ 익일 09:00
            start = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 18, 0, 0, 0);
            end = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + 1, 9, 0, 0, 0);
        }
        return { start, end };
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

            // 점호 기준 시간대 (18:00 ~ 익일 09:00) - 홍지관일지, 양현재일지, 환자, 시설물 모두 공통 통일 적용
            const { start: violationStart, end: violationEnd } = getRollcallRange(selectedDate);

            const curYear = now.getFullYear();
            const curMonth = now.getMonth() + 1;

            // Parallel Data Fetching
            const [
                studentsRes,
                teachersRes,
                leavesRes,
                violationsRes,
                roomsRes,
                seatsRes,
                currentMonthAppsRes,
                nextMonthAppsRes,
                holidaysRes
            ] = await Promise.all([
                supabase.from("students").select("*"),
                supabase.from("teachers").select("*", { count: "exact", head: true }),
                supabase.from("leave_requests")
                    .select("*, leave_request_students(student_id)")
                    .eq("status", "승인")
                    .lte("start_time", endOfDay.toISOString())
                    .gte("end_time", startOfDay.toISOString()),
                supabase.from('morning_checks')
                    .select('id, student_id, checked_at, note, type, teacher_id')
                    .in('type', ['late', 'yanghyeonjae'])
                    .gte('checked_at', new Date(Math.min(startOfDay.getTime(), violationStart.getTime())).toISOString())
                    .lte('checked_at', new Date(Math.max(endOfDay.getTime(), violationEnd.getTime())).toISOString()),
                supabase.from("room_layouts").select("room_number, total_seats"),
                supabase.from("seat_assignments").select("room_number, student_id"),
                supabase.from("monthly_return_applications")
                    .select("*")
                    .eq("target_year", curYear)
                    .eq("target_month", curMonth),
                supabase.from("monthly_return_applications")
                    .select("*")
                    .eq("target_year", targetYear)
                    .eq("target_month", targetMonth),
                supabase.from("special_holidays").select("date")
            ]);

            // --- Process 1: Students & Weekly Returnees ---
            const rawStudents = studentsRes.data || [];
            const students = rawStudents.filter((s: any) => !(
                (s.grade === 3 && s.class === 3 && s.number === 17 && s.name === '홍길동') ||
                (s.grade === 3 && s.class === 3 && s.number === 18 && s.name === '이순신') ||
                (s.grade === 1 && s.class === 2 && s.number === 8 && s.name === '이성진') ||
                s.student_id === '3317홍길동' ||
                s.student_id === '3318이순신' ||
                s.student_id === '1208이성진'
            ));
            const totalStudents = students.length;

            const curApps = currentMonthAppsRes.data || [];
            setCurrentMonthApps(curApps);

            const curAppsMap = new Map<string, boolean>();
            curApps.forEach((a: any) => curAppsMap.set(a.student_id, a.is_weekly));

            const isStudentWeeklyNow = (s: any) => {
                if (curAppsMap.has(s.student_id)) {
                    return !!curAppsMap.get(s.student_id);
                }
                return !!s.weekend;
            };

            const weekly = students.filter((s: any) => isStudentWeeklyNow(s)).sort((a: any, b: any) => {
                if (a.grade !== b.grade) return a.grade - b.grade;
                if (a.class !== b.class) return a.class - b.class;
                return a.number - b.number;
            });
            setWeeklyReturnees(weekly);
            setNextMonthApps(nextMonthAppsRes.data || []);
            setAllRawStudents(students);

            // --- Process 2: Leaves ---
            const activeLeaves = leavesRes.data || [];
            setAllLeaveRequests(activeLeaves);
            const holidaySet = new Set<string>(holidaysRes.data?.map((h: any) => h.date) || []);
            const isTodayDate = isSameDay(now, selectedDate);
            const isWeeklyReturnTime = isWeeklyReturnPeriod(isTodayDate ? now : selectedDate, holidaySet);

            const combinedOvernightIds = new Set<string>();
            const combinedShortIds = new Set<string>();

            activeLeaves.forEach((l: any) => {
                const isLeaveActive = isTodayDate ? (
                    now >= new Date(l.start_time) && now <= new Date(l.end_time)
                ) : true;

                if (isLeaveActive) {
                    if (l.leave_type === '외박') {
                        if (l.student_id) combinedOvernightIds.add(l.student_id);
                        l.leave_request_students?.forEach((co: any) => {
                            if (co.student_id) combinedOvernightIds.add(co.student_id);
                        });
                    } else if (l.leave_type === '외출') {
                        if (l.student_id) combinedShortIds.add(l.student_id);
                        l.leave_request_students?.forEach((co: any) => {
                            if (co.student_id) combinedShortIds.add(co.student_id);
                        });
                    }
                }
            });
            if (isWeeklyReturnTime) {
                weekly.forEach((s: any) => combinedOvernightIds.add(s.student_id));
            }

            const overnight = combinedOvernightIds.size;
            const short = combinedShortIds.size;
            setOvernightStudentIds(Array.from(combinedOvernightIds));
            setShortStudentIds(Array.from(combinedShortIds));

            // --- Process 3: Grade Stats ---
            const gradeStats = [1, 2, 3].map(g => {
                const gradeStudents = students.filter((s: any) => s.grade === g);
                const total = gradeStudents.length;
                const gradeStudentIds = new Set(gradeStudents.map((s: any) => s.student_id));
                let overnightCount = 0;
                let shortCount = 0;
                combinedOvernightIds.forEach(id => { if (gradeStudentIds.has(id)) overnightCount++; });
                combinedShortIds.forEach(id => { if (gradeStudentIds.has(id)) shortCount++; });

                // Gender breakdown (1층 = 여학생, 2~4층 = 남학생)
                const femaleStudents = gradeStudents.filter((s: any) => {
                    const room = s.room_number || s.room;
                    if (!room) return false;
                    const rNum = typeof room === 'number' ? room : parseInt(room, 10);
                    return !isNaN(rNum) && rNum >= 100 && rNum < 200;
                });
                const maleStudents = gradeStudents.filter((s: any) => {
                    const room = s.room_number || s.room;
                    if (!room) return true;
                    const rNum = typeof room === 'number' ? room : parseInt(room, 10);
                    return isNaN(rNum) || rNum >= 200;
                });

                const femaleIds = new Set(femaleStudents.map((s: any) => s.student_id));
                const maleIds = new Set(maleStudents.map((s: any) => s.student_id));

                let femaleOvernight = 0;
                let femaleShort = 0;
                combinedOvernightIds.forEach(id => { if (femaleIds.has(id)) femaleOvernight++; });
                combinedShortIds.forEach(id => { if (femaleIds.has(id)) femaleShort++; });

                let maleOvernight = 0;
                let maleShort = 0;
                combinedOvernightIds.forEach(id => { if (maleIds.has(id)) maleOvernight++; });
                combinedShortIds.forEach(id => { if (maleIds.has(id)) maleShort++; });

                return {
                    grade: g,
                    count: total,
                    overnight: overnightCount,
                    short: shortCount,
                    current: Math.max(0, total - overnightCount - shortCount),
                    femaleCount: femaleStudents.length,
                    femaleOvernight,
                    femaleShort,
                    femaleCurrent: Math.max(0, femaleStudents.length - femaleOvernight - femaleShort),
                    maleCount: maleStudents.length,
                    maleOvernight,
                    maleShort,
                    maleCurrent: Math.max(0, maleStudents.length - maleOvernight - maleShort)
                };
            });

            // --- Process 4: Floor Stats ---
            const floorStats = [1, 2, 3, 4].map(floor => {
                const floorStudents = students.filter((s: any) => {
                    const room = s.room_number || s.room;
                    if (!room) return false;
                    const rNum = typeof room === 'number' ? room : parseInt(room, 10);
                    return !isNaN(rNum) && rNum >= floor * 100 && rNum < (floor + 1) * 100;
                });
                const assignedCount = floorStudents.length;
                const floorStudentIds = new Set(floorStudents.map((s: any) => s.student_id));
                let floorOvernightCount = 0;
                let floorShortCount = 0;
                combinedOvernightIds.forEach(id => { if (floorStudentIds.has(id)) floorOvernightCount++; });
                combinedShortIds.forEach(id => { if (floorStudentIds.has(id)) floorShortCount++; });

                return {
                    floor,
                    capacity: assignedCount,
                    assigned: assignedCount,
                    overnight: floorOvernightCount,
                    short: floorShortCount,
                    current: Math.max(0, assignedCount - floorOvernightCount - floorShortCount)
                };
            });

            // Unassigned students count (no room assigned)
            const unassignedStudents = students.filter((s: any) => !(s.room_number || s.room));
            const unassignedCount = unassignedStudents.length;

            // --- Process 5: Violations (Hongjigwan & Yanghyeonjae) ---
            const allChecks = violationsRes.data || [];
            const studentMap = new Map();
            students.forEach((s: any) => studentMap.set(s.student_id, s.name));

            // 1) Hongjigwan violations (late / room checks in rollcall window)
            const hongjigwanRaw = allChecks.filter((v: any) => 
                (v.type === 'late' || !v.type) &&
                new Date(v.checked_at) >= violationStart &&
                new Date(v.checked_at) <= violationEnd
            );
            const violationList = hongjigwanRaw.map((v: any) => ({
                id: v.id,
                student_id: v.student_id,
                student_name: studentMap.get(v.student_id) || v.student_id,
                checked_at: v.checked_at,
                note: v.note || '일과시간 미준수',
                teacher_id: v.teacher_id
            }));

            // 2) Yanghyeonjae violations (type === 'yanghyeonjae' in rollcall window: 18:00~익일 09:00)
            const yanghyeonjaeRaw = allChecks.filter((v: any) => 
                v.type === 'yanghyeonjae' &&
                new Date(v.checked_at) >= violationStart &&
                new Date(v.checked_at) <= violationEnd
            );
            const yanghyeonjaeList = yanghyeonjaeRaw.map((v: any) => ({
                id: v.id,
                student_id: v.student_id,
                student_name: studentMap.get(v.student_id) || v.student_id,
                checked_at: v.checked_at,
                note: v.note || '면학실 수칙 위반',
                teacher_id: v.teacher_id
            }));

            setStats({
                totalStudents: totalStudents || 0,
                totalTeachers: teachersRes.count || 0,
                studentsByGrade: gradeStats,
                studentsByFloor: floorStats,
                unassignedCount,
                currentLeaves: { overnight: overnight, short: short },
                violationCount: violationList.length,
                violationList,
                yanghyeonjaeCount: yanghyeonjaeList.length,
                yanghyeonjaeList
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
    };

    const handleDeleteViolation = async (v: any) => {
        if (!confirm(`${v.student_id} ${v.student_name} 학생의 '${v.note}' 위반 내역을 삭제하시겠습니까?`)) return;

        const originalStats = { ...stats };
        setStats(prev => ({
            ...prev,
            violationCount: Math.max(0, prev.violationCount - 1),
            violationList: prev.violationList.filter(item => item.id !== v.id)
        }));

        try {
            const { error } = await supabase.from('morning_checks').delete().eq('id', v.id);
            if (error) {
                console.error('[Dashboard] Delete Error:', error);
                toast.error('삭제 실패 (DB 권한 확인 필요)');
                setStats(originalStats);
            } else {
                toast.success('위반 내역이 삭제되었습니다.');
            }
        } catch (e) {
            console.error('[Dashboard] Delete Exception:', e);
            toast.error('삭제 중 오류가 발생했습니다.');
            setStats(originalStats);
        }
    };

    const handleDeleteYanghyeonjaeViolation = async (v: any) => {
        if (!confirm(`${v.student_id} ${v.student_name} 학생의 [${v.note}] 양현재 위반 내역을 삭제하시겠습니까?`)) return;

        const originalStats = { ...stats };
        setStats(prev => ({
            ...prev,
            yanghyeonjaeCount: Math.max(0, prev.yanghyeonjaeCount - 1),
            yanghyeonjaeList: prev.yanghyeonjaeList.filter(item => item.id !== v.id)
        }));

        try {
            const { error } = await supabase.from('morning_checks').delete().eq('id', v.id);
            if (error) {
                console.error('[Dashboard] Delete Yanghyeonjae Error:', error);
                toast.error('삭제 실패 (DB 권한 확인 필요)');
                setStats(originalStats);
            } else {
                toast.success('양현재 위반 내역이 삭제되었습니다.');
            }
        } catch (e) {
            console.error('[Dashboard] Delete Exception:', e);
            toast.error('삭제 중 오류가 발생했습니다.');
            setStats(originalStats);
        }
    };

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

    const handleCopyDailyShareLink = async () => {
        try {
            const todayStr = getKSTDateString();
            const token = generateDailyToken(todayStr);
            const origin = window.location.origin;
            const shareUrl = `${origin}/today?date=${todayStr}&token=${token}`;

            await navigator.clipboard.writeText(shareUrl);
            toast.success(
                (t) => (
                    <div className="flex flex-col gap-0.5 text-left">
                        <span className="font-bold text-xs text-gray-900">오늘의 열람 링크가 복사되었습니다!</span>
                        <span className="text-[11px] text-gray-500">메신저에 붙여넣기(Ctrl+V)하여 공유하세요. (당일만 유효)</span>
                    </div>
                ),
                { duration: 4000 }
            );
        } catch (err) {
            toast.error("링크 복사에 실패했습니다. 브라우저 권한을 확인해주세요.");
        }
    };

    const rollcallRange = useMemo(() => getRollcallRange(selectedDate), [selectedDate]);

    const filteredFacility = facilityRequests.filter(req => {
        const created = new Date(req.created_at);
        return created >= rollcallRange.start && created <= rollcallRange.end;
    });

    const filteredPatients = patients.filter(p => {
        const created = new Date(p.created_at);
        return created >= rollcallRange.start && created <= rollcallRange.end;
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
                    {/* Left: 달력 바 */}
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

                    {/* Right: 액션 버튼들 */}
                    <div className="flex items-center gap-2">
                        {!readOnly ? (
                            <>
                                <button
                                    onClick={handleCopyDailyShareLink}
                                    className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold px-3 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer text-xs sm:text-sm"
                                    title="오늘의 홍지관 공유 링크 복사 (당일 한정 유효)"
                                >
                                    <FaShareAlt className="text-xs" />
                                    <span className="hidden sm:inline">오늘 링크 복사</span>
                                    <span className="sm:hidden">링크 복사</span>
                                </button>
                                <button
                                    onClick={() => router.push('/teacher')}
                                    className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 font-bold p-2 sm:p-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center cursor-pointer active:scale-95"
                                    title="교사 홈으로 이동"
                                >
                                    <HiHome className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
                                </button>
                            </>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                                    열람 전용
                                </span>
                                <button
                                    onClick={() => window.print()}
                                    className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-bold px-2.5 py-1.5 rounded-xl text-xs shadow-2xs transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                    title="인쇄 또는 PDF 저장"
                                >
                                    <FaPrint className="text-gray-500 text-xs" />
                                    <span>인쇄</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="px-6 max-w-xl mx-auto md:max-w-4xl mt-4 flex flex-col gap-3.5">
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
                <div className="bg-gray-900 text-white p-2.5 rounded-2xl shadow-sm flex items-center justify-between px-3 md:px-5 whitespace-nowrap overflow-x-auto no-scrollbar">
                    <div className="flex items-center justify-between w-full gap-1.5 sm:gap-3 text-[11px] sm:text-xs md:text-sm font-bold whitespace-nowrap">
                        <span className="shrink-0 text-gray-300">정원 : {stats.totalStudents}명</span>
                        <button
                            onClick={() => {
                                setLeaveListModal({ isOpen: true, title: '외박자 명단', type: 'overnight', studentIds: overnightStudentIds });
                                setLeaveModalSearchQuery('');
                            }}
                            className="text-red-400 hover:text-red-300 hover:bg-white/10 px-2 py-0.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 border border-red-500/40 group shrink-0"
                            title="클릭하여 외박자 명단 보기"
                        >
                            <span>외박자 : {stats.currentLeaves.overnight}명</span>
                            <span className="text-[9px] sm:text-[10px] bg-red-500/25 group-hover:bg-red-500/40 text-red-200 px-1.5 py-0.5 rounded-md font-semibold tracking-tighter">상세</span>
                        </button>
                        <button
                            onClick={() => {
                                setLeaveListModal({ isOpen: true, title: '외출자 명단', type: 'short', studentIds: shortStudentIds });
                                setLeaveModalSearchQuery('');
                            }}
                            className="text-emerald-400 hover:text-emerald-300 hover:bg-white/10 px-2 py-0.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 border border-emerald-500/40 group shrink-0"
                            title="클릭하여 외출자 명단 보기"
                        >
                            <span>외출자 : {stats.currentLeaves.short}명</span>
                            <span className="text-[9px] sm:text-[10px] bg-emerald-500/25 group-hover:bg-emerald-500/40 text-emerald-200 px-1.5 py-0.5 rounded-md font-semibold tracking-tighter">상세</span>
                        </button>
                        <span className="shrink-0 text-gray-300">현재원 : {stats.studentsByGrade.reduce((acc, curr) => acc + curr.current, 0)}명</span>
                    </div>
                </div>

                {/* Grade-level Headcount (Horizontal) */}
                <div className="bg-white px-3 sm:px-3.5 pt-2 pb-2.5 sm:pb-3 rounded-[1.5rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 flex flex-col gap-1">
                    {/* Column Header */}
                    <div className="grid grid-cols-5 text-center text-[11px] font-bold text-gray-400 px-2 py-0 leading-tight">
                        <div className="text-left pl-1">학년</div>
                        <div className="text-gray-600">총원</div>
                        <div className="text-red-500">외박</div>
                        <div className="text-emerald-600">외출</div>
                        <div className="text-blue-600">현재</div>
                    </div>

                    {/* Rows */}
                    <div className="flex flex-col gap-1">
                        {stats.studentsByGrade.map(g => (
                            <div
                                key={`g-${g.grade}`}
                                className="grid grid-cols-5 items-center text-center py-1.5 px-2 bg-gray-50/70 hover:bg-gray-50 rounded-xl border border-gray-100 transition-colors"
                            >
                                {/* Grade Badge */}
                                <div className="flex items-center justify-start pl-1">
                                    <span className={`px-2 py-0.5 rounded-lg font-black text-xs border ${
                                        g.grade === 1 ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                        g.grade === 2 ? 'bg-purple-50 text-purple-600 border-purple-200' :
                                        'bg-orange-50 text-orange-600 border-orange-200'
                                    }`}>
                                        {g.grade}학년
                                    </span>
                                </div>

                                {/* 총원 */}
                                <div className="flex flex-col items-center justify-center leading-none">
                                    <span className="text-xs sm:text-sm font-black text-gray-800 leading-tight">{g.count}</span>
                                    <span className="text-[9px] sm:text-[10px] text-gray-400 font-medium whitespace-nowrap mt-0.5">
                                        여 {g.femaleCount || 0} · 남 {g.maleCount || 0}
                                    </span>
                                </div>

                                {/* 외박 */}
                                <div className="flex flex-col items-center justify-center leading-none">
                                    <span className="text-xs sm:text-sm font-black text-red-500 leading-tight">{g.overnight}</span>
                                    <span className="text-[9px] sm:text-[10px] text-red-400 font-medium whitespace-nowrap mt-0.5">
                                        여 {g.femaleOvernight || 0} · 남 {g.maleOvernight || 0}
                                    </span>
                                </div>

                                {/* 외출 */}
                                <div className="flex flex-col items-center justify-center leading-none">
                                    <span className="text-xs sm:text-sm font-black text-emerald-600 leading-tight">{g.short}</span>
                                    <span className="text-[9px] sm:text-[10px] text-emerald-500 font-medium whitespace-nowrap mt-0.5">
                                        여 {g.femaleShort || 0} · 남 {g.maleShort || 0}
                                    </span>
                                </div>

                                {/* 현재 */}
                                <div className="flex flex-col items-center justify-center leading-none">
                                    <span className="text-xs sm:text-sm font-black text-blue-600 leading-tight">{g.current}</span>
                                    <span className="text-[9px] sm:text-[10px] text-blue-400 font-medium whitespace-nowrap mt-0.5">
                                        여 {g.femaleCurrent || 0} · 남 {g.maleCurrent || 0}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Floor-level Headcount (Horizontal, slim compact rows 4F -> 1F) */}
                <div className="bg-white p-3 sm:p-3.5 rounded-[1.5rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 flex flex-col gap-1.5">
                    {/* Rows: 4F down to 1F like real building floors */}
                    <div className="flex flex-col gap-1">
                        {[...stats.studentsByFloor].reverse().map(f => (
                            <div
                                key={`f-${f.floor}`}
                                className="grid grid-cols-5 items-center text-center py-1.5 px-2 bg-gray-50/70 hover:bg-gray-50 rounded-xl border border-gray-100 transition-colors"
                            >
                                {/* Floor Badge */}
                                <div className="flex items-center justify-start pl-1">
                                    <span className="px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xs font-black text-indigo-600">
                                        {f.floor}F
                                    </span>
                                </div>

                                {/* 배정 */}
                                <div className="flex flex-col items-center justify-center leading-none">
                                    <span className="text-xs sm:text-sm font-black text-gray-800 leading-tight">{f.assigned}</span>
                                </div>

                                {/* 외박 */}
                                <div className="flex flex-col items-center justify-center leading-none">
                                    <span className="text-xs sm:text-sm font-black text-red-500 leading-tight">{f.overnight}</span>
                                </div>

                                {/* 외출 */}
                                <div className="flex flex-col items-center justify-center leading-none">
                                    <span className="text-xs sm:text-sm font-black text-emerald-600 leading-tight">{f.short}</span>
                                </div>

                                {/* 현재 */}
                                <div className="flex flex-col items-center justify-center leading-none">
                                    <span className="text-xs sm:text-sm font-black text-indigo-600 leading-tight">{f.current}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {stats.unassignedCount && stats.unassignedCount > 0 ? (
                        <div className="bg-amber-50/70 px-3 py-1.5 rounded-lg border border-amber-200/60 flex items-center justify-between text-xs mt-0.5">
                            <span className="font-bold text-amber-800 text-[11px]">호실 미배정 학생</span>
                            <span className="font-black text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full text-[11px]">
                                {stats.unassignedCount}명
                            </span>
                        </div>
                    ) : null}
                </div>

                    {/* Monthly Returnee Wide Button */}
                    <div>
                        <button
                            onClick={() => setIsWeeklyListModalOpen(true)}
                            className="w-full py-4 px-5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] border border-blue-500 rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-between cursor-pointer text-white"
                        >
                            <div className="text-left">
                                <div className="flex items-center gap-2.5">
                                    <h3 className="font-black text-white text-sm sm:text-base tracking-tight">
                                        귀가자 명단 / 관리
                                    </h3>
                                    <span className="text-[11px] font-extrabold text-blue-700 bg-white px-2.5 py-0.5 rounded-full shadow-xs">
                                        매주 {weeklyReturnees.length}명
                                    </span>
                                </div>
                                <p className="text-[11px] text-blue-100 font-medium mt-0.5">이번달 매주귀가 및 학년별 현황 보기</p>
                            </div>

                            <span className="text-xs font-bold text-white bg-white/20 hover:bg-white/30 border border-white/20 px-3 py-1.5 rounded-xl shadow-2xs">
                                현황 보기
                            </span>
                        </button>
                    </div>

                    {/* Violation Counter & Cards */}
                    <div className="bg-white p-4 sm:p-5 rounded-[1.5rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 flex flex-col gap-3.5">
                        {/* Header: Title, Counts, and Monthly Stats Button */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <div className="relative px-4 py-2 rounded-xl bg-gradient-to-b from-[#2a5d42] to-[#1f4933] border-2 border-[#8c5e39] shadow-[inset_0_2px_5px_rgba(0,0,0,0.4),0_2px_6px_rgba(0,0,0,0.15)] flex items-center gap-3 select-none">
                                    <h3
                                        style={{ fontFamily: "'SchoolSafetyStubbyChalk', 'SchoolSafetyChalk', cursive" }}
                                        className="text-xl sm:text-2xl text-white/95 leading-none tracking-wider [text-shadow:_0_0_1px_rgba(255,255,255,0.95),_0_0_2px_rgba(255,255,255,0.5)]"
                                    >
                                        홍지관 일지
                                    </h3>
                                    <span
                                        style={{ fontFamily: "'SchoolSafetyStubbyChalk', 'SchoolSafetyChalk', cursive" }}
                                        className="text-base sm:text-lg text-[#fef08a] leading-none [text-shadow:_0_0_1px_rgba(253,224,71,0.9),_0_0_2px_rgba(253,224,71,0.5)] border border-dashed border-[#fde047]/60 px-2 py-0.5 rounded-full"
                                    >
                                        {stats.violationCount}명
                                    </span>
                                </div>
                            </div>

                            {/* Monthly Stats Action Button */}
                            <button
                                onClick={() => {
                                    setViolationStatsFilter('month');
                                    setIsViolationStatsOpen(true);
                                }}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold text-gray-700 bg-gray-50 hover:bg-slate-100 hover:text-gray-900 border border-gray-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
                                title="월간 통계 보기"
                            >
                                <FaChartBar size={12} className="text-slate-500" />
                                <span>월간 통계</span>
                            </button>
                        </div>

                        {/* Cards List or Empty State */}
                        <div className="pt-2 border-t border-gray-100">
                            {stats.violationList.length === 0 ? (
                                <div className="py-6 px-4 bg-gray-50/60 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
                                    <p className="text-xs font-bold text-gray-700">금일 홍지관 위반 학생이 없습니다</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-0.5">
                                    {stats.violationList.map((v, vIdx) => {
                                        const noteStyle: string = (
                                            v.note === '스토퍼 미설치' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                            v.note === '일과시간 미준수' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                            v.note === '청소불량' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                            v.note === '음식물 섭취 위반' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                            v.note === '박스 방치' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                            v.note === '퇴실수칙 불이행' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                            v.note === '호실이동' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                                            'bg-slate-100 text-slate-700 border-slate-200'
                                        );

                                        // student_id가 '2308신성호'처럼 이름을 이미 포함하고 있는 경우 중복 출력 방지
                                        const studentDisplayName = v.student_name && v.student_id?.includes(v.student_name)
                                            ? v.student_id
                                            : `${v.student_id || ''} ${v.student_name || ''}`.trim();

                                        return (
                                            <div
                                                key={v.id || `today-violation-${vIdx}`}
                                                className="group flex items-start justify-between bg-white hover:bg-slate-50/70 border border-gray-200/90 rounded-xl p-3 shadow-2xs transition-all gap-3"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-extrabold text-gray-900 text-xs sm:text-sm">
                                                            {studentDisplayName}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold border ${noteStyle}`}>
                                                            {v.note}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[10px] sm:text-[11px] text-gray-400">
                                                        {v.checked_at && (
                                                            <span className="flex items-center gap-1 font-medium">
                                                                <FaClock size={9} />
                                                                {new Date(v.checked_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })} 기록
                                                            </span>
                                                        )}
                                                        {v.teacher_id && (
                                                            <span className="text-slate-600 font-bold bg-slate-100 border border-slate-200/70 px-1.5 py-0.5 rounded text-[10px]">
                                                                지도 : {v.teacher_id}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {!readOnly && (
                                                    <button
                                                        onClick={() => handleDeleteViolation(v)}
                                                        title="위반 기록 삭제"
                                                        className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-rose-50 text-gray-400 hover:text-rose-600 border border-gray-200 flex items-center justify-center transition-colors shrink-0 cursor-pointer active:scale-95 shadow-2xs mt-0.5"
                                                    >
                                                        <FaTrash size={10} />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Yanghyeonjae Violation Cards */}
                    <div className="bg-white p-4 sm:p-5 rounded-[1.5rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 flex flex-col gap-3.5">
                        {/* Header: Title, Counts, and Monthly Stats Button */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <div className="relative px-4 py-2 rounded-xl bg-gradient-to-b from-[#1e293b] to-[#0f172a] border-2 border-[#8c5e39] shadow-[inset_0_2px_5px_rgba(0,0,0,0.4),0_2px_6px_rgba(0,0,0,0.15)] flex items-center gap-3 select-none">
                                    <h3
                                        style={{ fontFamily: "'SchoolSafetyStubbyChalk', 'SchoolSafetyChalk', cursive" }}
                                        className="text-xl sm:text-2xl text-white/95 leading-none tracking-wider [text-shadow:_0_0_1px_rgba(255,255,255,0.95),_0_0_2px_rgba(255,255,255,0.5)]"
                                    >
                                        양현재 일지
                                    </h3>
                                    <span
                                        style={{ fontFamily: "'SchoolSafetyStubbyChalk', 'SchoolSafetyChalk', cursive" }}
                                        className="text-base sm:text-lg text-[#93c5fd] leading-none [text-shadow:_0_0_1px_rgba(147,197,253,0.9),_0_0_2px_rgba(147,197,253,0.5)] border border-dashed border-[#93c5fd]/60 px-2 py-0.5 rounded-full"
                                    >
                                        {stats.yanghyeonjaeCount}명
                                    </span>
                                </div>
                            </div>

                            {/* Monthly Stats Action Button */}
                            <button
                                onClick={() => {
                                    setYanghyeonjaeStatsFilter('month');
                                    setIsYanghyeonjaeStatsOpen(true);
                                }}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold text-gray-700 bg-gray-50 hover:bg-slate-100 hover:text-gray-900 border border-gray-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
                                title="월간 통계 보기"
                            >
                                <FaChartBar size={12} className="text-slate-500" />
                                <span>월간 통계</span>
                            </button>
                        </div>

                        {/* Cards List or Empty State */}
                        <div className="pt-2 border-t border-gray-100">
                            {stats.yanghyeonjaeList.length === 0 ? (
                                <div className="py-6 px-4 bg-gray-50/60 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
                                    <p className="text-xs font-bold text-gray-700">금일 양현재 위반 학생이 없습니다</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-0.5">
                                    {stats.yanghyeonjaeList.map((v, vIdx) => {
                                        const rawNote = v.note || '';
                                        let category = rawNote;
                                        let detail = '';
                                        if (rawNote.includes(': ')) {
                                            const parts = rawNote.split(': ');
                                            category = parts[0];
                                            detail = parts.slice(1).join(': ');
                                        } else if (rawNote.includes(':')) {
                                            const parts = rawNote.split(':');
                                            category = parts[0];
                                            detail = parts.slice(1).join(':').trim();
                                        }

                                        const getCategoryStyle = (cat: string) => {
                                            switch (cat.trim()) {
                                                case '졸음':
                                                    return 'bg-blue-50 text-blue-700 border-blue-200';
                                                case '전자기기 위반':
                                                    return 'bg-purple-50 text-purple-700 border-purple-200';
                                                case '무단이석':
                                                case '무단 이석':
                                                    return 'bg-amber-50 text-amber-700 border-amber-200';
                                                case '지각 입실':
                                                case '지각입실':
                                                    return 'bg-orange-50 text-orange-700 border-orange-200';
                                                case '소란':
                                                    return 'bg-rose-50 text-rose-700 border-rose-200';
                                                case '기타':
                                                default:
                                                    return 'bg-slate-100 text-slate-700 border-slate-300';
                                            }
                                        };

                                        // student_id가 '2308신성호'처럼 이름을 이미 포함하고 있는 경우 중복 출력 방지
                                        const studentDisplayName = v.student_name && v.student_id?.includes(v.student_name)
                                            ? v.student_id
                                            : `${v.student_id || ''} ${v.student_name || ''}`.trim();

                                        return (
                                            <div
                                                key={v.id || `yanghyeonjae-${vIdx}`}
                                                className="group flex items-start justify-between bg-white hover:bg-slate-50/70 border border-gray-200/90 rounded-xl p-3 shadow-2xs transition-all gap-3"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-extrabold text-gray-900 text-xs sm:text-sm">
                                                            {studentDisplayName}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold border ${getCategoryStyle(category)}`}>
                                                            {category}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[10px] sm:text-[11px] text-gray-400">
                                                        {v.checked_at && (
                                                            <span className="flex items-center gap-1 font-medium">
                                                                <FaClock size={9} />
                                                                {new Date(v.checked_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })} 기록
                                                            </span>
                                                        )}
                                                        {v.teacher_id && (
                                                            <span className="text-slate-600 font-bold bg-slate-100 border border-slate-200/70 px-1.5 py-0.5 rounded text-[10px]">
                                                                지도 : {v.teacher_id}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {detail && (
                                                        <div className="mt-1.5 text-xs text-slate-700 bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5 leading-relaxed break-words font-medium">
                                                            {detail}
                                                        </div>
                                                    )}
                                                </div>

                                                {!readOnly && (
                                                    <button
                                                        onClick={() => handleDeleteYanghyeonjaeViolation(v)}
                                                        title="위반 기록 삭제"
                                                        className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-rose-50 text-gray-400 hover:text-rose-600 border border-gray-200 flex items-center justify-center transition-colors shrink-0 cursor-pointer active:scale-95 shadow-2xs mt-0.5"
                                                    >
                                                        <FaTrash size={10} />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Patient Card */}
                    <div className="bg-white p-4 sm:p-5 rounded-[1.5rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 flex flex-col gap-3">
                        {/* Title Header */}
                        <div className="flex justify-between items-center gap-2">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-black text-gray-900 text-sm sm:text-base tracking-tight leading-tight">환자 현황 (보건실)</h3>
                                    <span className="text-[11px] font-extrabold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full leading-none">
                                        {filteredPatients.length}명
                                    </span>
                                </div>
                                <p className="text-[11px] text-gray-400 font-medium mt-0.5 leading-tight">18:00 ~ 익일 09:00 점호 기준</p>
                            </div>

                            {/* Monthly Stats Button */}
                            <button
                                onClick={() => setIsPatientStatsOpen(true)}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold text-gray-700 bg-gray-50 hover:bg-slate-100 border border-gray-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
                            >
                                <FaChartBar size={11} className="text-gray-500" />
                                <span>월간 통계</span>
                            </button>
                        </div>

                        {/* Input Row */}
                        {!readOnly && (
                            <div className="flex flex-col sm:flex-row gap-3 sm:items-center relative">
                                <div className="relative w-full sm:w-44 shrink-0">
                                    <input
                                        type="text"
                                        className="bg-gray-50 border border-gray-200/60 rounded-xl px-3.5 py-2 text-xs sm:text-sm w-full outline-none focus:bg-white focus:border-blue-400 transition-all h-10"
                                        placeholder="이름/학번 검색"
                                        value={searchQuery}
                                        onFocus={() => setShowSearch(true)}
                                        onBlur={() => setTimeout(() => setShowSearch(false), 200)}
                                        onChange={e => {
                                            setSearchQuery(e.target.value);
                                            setShowSearch(true);
                                        }}
                                    />
                                    {showSearch && searchResults.length > 0 && (
                                        <div className="absolute top-full left-0 w-full sm:w-56 bg-white border border-gray-100 shadow-xl rounded-xl mt-1.5 z-50 overflow-hidden">
                                            {searchResults.map((s, sIdx) => (
                                                <div
                                                    key={s.student_id || `search-result-${sIdx}`}
                                                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between group border-b border-gray-50 last:border-b-0"
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

                                <div className="flex gap-3 flex-1 w-full">
                                    <input
                                        id="patient-symptom-input"
                                        type="text"
                                        className="bg-gray-50 border border-gray-200/60 rounded-xl px-3.5 py-2 text-xs sm:text-sm flex-1 outline-none focus:bg-white focus:border-blue-400 transition-all min-w-0 h-10"
                                        placeholder="증상 입력"
                                        value={newPatient.symptom}
                                        onChange={e => setNewPatient({ ...newPatient, symptom: e.target.value })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleCreatePatient(searchResults.find(s => s.name === searchQuery || s.student_id === searchQuery));
                                        }}
                                    />
                                    <button
                                        onClick={() => handleCreatePatient(searchResults.find(s => s.name === searchQuery || s.student_id === searchQuery))}
                                        className="bg-gray-900 text-white w-10 sm:w-11 h-10 rounded-xl flex items-center justify-center hover:bg-black active:scale-95 transition shrink-0 cursor-pointer shadow-xs"
                                        title="환자 등록"
                                    >
                                        <FaPlus size={12} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Patient List */}
                        <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto pr-0.5">
                            {filteredPatients.length === 0 ? (
                                <div className="py-4 text-center text-gray-400 text-xs font-medium bg-gray-50/60 rounded-xl border border-dashed border-gray-200">
                                    환자가 없습니다
                                </div>
                            ) : filteredPatients.map((p, pIdx) => (
                                <div
                                    key={p.id || `patient-${pIdx}`}
                                    className="group flex items-center justify-between bg-[#1a1a1a] hover:bg-[#222] border border-white/5 rounded-2xl px-3.5 py-2.5 shadow-md transition-all gap-3 min-h-[52px]"
                                >
                                    <div className="w-7 h-7 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 flex items-center justify-center text-xs font-black shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.3)]">
                                        {p.student_name ? p.student_name[0] : '환'}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-white font-bold text-xs sm:text-sm">{p.student_name}</span>
                                            <span className="text-gray-400 text-[11px] font-normal">({p.student_id})</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                                                증상: {p.symptom}
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                                {p.created_at ? p.created_at.substring(5, 10).replace('-', '.') : ''}
                                            </span>
                                        </div>
                                    </div>

                                    {!readOnly && (
                                        <button
                                            onClick={() => handleDeletePatient(p.id)}
                                            title="삭제"
                                            className="w-7 h-7 rounded-full bg-white/5 hover:bg-rose-500 text-gray-400 hover:text-white flex items-center justify-center transition-colors shrink-0 active:scale-95 cursor-pointer shadow-xs"
                                        >
                                            <FaTrash size={10} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Facility Card */}
                    <div className="bg-white p-4 sm:p-5 rounded-[1.5rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 flex flex-col gap-3">
                        <div className="flex justify-between items-center gap-2">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-black text-gray-900 text-sm sm:text-base tracking-tight leading-tight">시설물 수리 요청</h3>
                                    <span className="text-[11px] font-extrabold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full leading-none">
                                        {filteredFacility.length}건
                                    </span>
                                </div>
                                <p className="text-[11px] text-gray-400 font-medium mt-0.5 leading-tight">18:00 ~ 익일 09:00 점호 기준</p>
                            </div>

                            {/* Monthly Stats Button */}
                            <button
                                onClick={() => setIsFacilityStatsOpen(true)}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold text-gray-700 bg-gray-50 hover:bg-slate-100 border border-gray-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
                            >
                                <FaChartBar size={11} className="text-gray-500" />
                                <span>월간 통계</span>
                            </button>
                        </div>

                        {!readOnly && (
                            <div className="flex gap-3 items-center">
                                <input
                                    type="text"
                                    className="bg-gray-50 border border-gray-200/60 rounded-xl px-3.5 py-2 text-xs sm:text-sm flex-1 outline-none focus:bg-white focus:border-blue-400 transition-all h-10"
                                    placeholder="층과 호실을 꼭 기입해주세요."
                                    value={newFacility.title}
                                    onChange={e => setNewFacility({ ...newFacility, title: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleCreateFacility();
                                    }}
                                />
                                <button
                                    onClick={handleCreateFacility}
                                    className="bg-gray-900 text-white w-10 sm:w-11 h-10 rounded-xl flex items-center justify-center hover:bg-black active:scale-95 transition shrink-0 cursor-pointer shadow-xs"
                                    title="수리 요청 등록"
                                >
                                    <FaPlus size={12} />
                                </button>
                            </div>
                        )}

                        <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto pr-0.5">
                            {filteredFacility.length === 0 ? (
                                <div className="py-4 text-center text-gray-400 text-xs font-medium bg-gray-50/60 rounded-xl border border-dashed border-gray-200">
                                    요청 내역이 없습니다
                                </div>
                            ) : filteredFacility.map((req, reqIdx) => (
                                <div
                                    key={req.id || `facility-${reqIdx}`}
                                    onClick={!readOnly ? () => handleToggleFacilityStatus(req.id, req.status) : undefined}
                                    className={`group flex items-center justify-between bg-[#1a1a1a] hover:bg-[#222] border border-white/5 rounded-2xl px-3.5 py-2.5 shadow-md transition-all gap-3 min-h-[52px] ${
                                        !readOnly ? 'cursor-pointer' : ''
                                    } ${
                                        req.status === '완료' ? 'opacity-50 grayscale-[30%]' : ''
                                    }`}
                                >
                                    <div
                                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                            req.status === '완료'
                                                ? 'bg-blue-500 border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]'
                                                : 'border-white/30 hover:border-blue-400 bg-white/5'
                                        }`}
                                    >
                                        {req.status === '완료' && <FaCheck className="text-white text-[10px]" />}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h4 className={`font-bold text-xs sm:text-sm truncate transition-colors ${
                                            req.status === '완료' ? 'text-gray-400 line-through' : 'text-white'
                                        }`}>
                                            {req.title}
                                        </h4>
                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-blue-300 border border-white/10">
                                                {req.room_number ? `${req.room_number}호` : '공용'}
                                            </span>
                                            <span className="text-[11px] text-gray-400">
                                                {req.created_at ? req.created_at.substring(5, 10).replace('-', '.') : ''}
                                            </span>
                                            {req.status === '완료' && (
                                                <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full border border-blue-500/20">
                                                    완료
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {!readOnly && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteFacility(req.id);
                                            }}
                                            title="삭제"
                                            className="w-7 h-7 rounded-full bg-white/5 hover:bg-rose-500 text-gray-400 hover:text-white flex items-center justify-center transition-colors shrink-0 active:scale-95 cursor-pointer shadow-xs"
                                        >
                                            <FaTrash size={10} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            <MorningCheckoutModal
                key="main-morning-checkout-modal"
                isOpen={isMorningModalOpen}
                onClose={() => setIsMorningModalOpen(false)}
            />

            <ViolationStatsModal
                key={`main-violation-stats-modal-${violationStatsFilter}`}
                isOpen={isViolationStatsOpen}
                onClose={() => setIsViolationStatsOpen(false)}
                initialFilter={violationStatsFilter}
                selectedDate={selectedDate}
                readOnly={readOnly}
            />

            <FacilityStatsModal
                isOpen={isFacilityStatsOpen}
                onClose={() => {
                    setIsFacilityStatsOpen(false);
                    fetchFacilityData();
                }}
                selectedDate={selectedDate}
            />

            <PatientStatsModal
                isOpen={isPatientStatsOpen}
                onClose={() => {
                    setIsPatientStatsOpen(false);
                    fetchPatientData();
                }}
                selectedDate={selectedDate}
            />

            <YanghyeonjaeStatsModal
                key={`main-yanghyeonjae-stats-modal-${yanghyeonjaeStatsFilter}`}
                isOpen={isYanghyeonjaeStatsOpen}
                onClose={() => setIsYanghyeonjaeStatsOpen(false)}
                initialFilter={yanghyeonjaeStatsFilter}
                selectedDate={selectedDate}
                readOnly={readOnly}
                onUpdate={() => setRefreshKey(prev => prev + 1)}
            />

            {isWeeklyListModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={() => {
                    setIsWeeklyListModalOpen(false);
                    setNextMonthSearchQuery('');
                }}>
                    <div className="bg-white w-full max-w-md rounded-[1.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="bg-blue-700 px-5 py-3.5 text-white">
                            <div className="flex justify-between items-center mb-2.5">
                                <h3 className="font-black text-base sm:text-lg tracking-tight">귀가자 명단 / 관리</h3>
                                <div className="flex items-center gap-2">
                                    <span className="bg-white/20 px-2.5 py-0.5 rounded-lg text-xs font-bold">
                                        {viewMonthMode === 'current' ? (
                                            `${weeklyReturnees.length}명`
                                        ) : (() => {
                                            const activeCount = allRawStudents.filter(s => {
                                                const app = nextMonthApps.find(a => a.student_id === s.student_id);
                                                return app ? app.is_weekly : !!s.weekend;
                                            }).length;
                                            const excludedCount = allRawStudents.filter(s => {
                                                const app = nextMonthApps.find(a => a.student_id === s.student_id);
                                                return app !== undefined && !app.is_weekly && !!s.weekend;
                                            }).length;
                                            return excludedCount > 0 
                                                ? `매주 ${activeCount}명 (제외 ${excludedCount}명)`
                                                : `${activeCount}명`;
                                        })()}
                                    </span>
                                    <button onClick={() => {
                                        setIsWeeklyListModalOpen(false);
                                        setNextMonthSearchQuery('');
                                        setCurrentMonthSearchQuery('');
                                    }} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer font-bold text-sm">✕</button>
                                </div>
                            </div>
                            <div className="flex bg-white/10 p-1 rounded-xl text-xs font-bold">
                                <button
                                    onClick={() => setViewMonthMode('current')}
                                    className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${viewMonthMode === 'current' ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-100 hover:text-white'}`}
                                >
                                    {new Date().getMonth() + 1}월 현재
                                </button>
                                <button
                                    onClick={() => setViewMonthMode('next')}
                                    className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${viewMonthMode === 'next' ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-100 hover:text-white'}`}
                                >
                                    {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).getMonth() + 1}월 예정
                                </button>
                            </div>
                        </div>

                        {/* 학년별 귀가 현황 요약 그리드 (모달 상단) */}
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 grid grid-cols-4 gap-1.5 shrink-0">
                            {[1, 2, 3].map(grade => {
                                const gradeInfo = stats.studentsByGrade.find(g => g.grade === grade);
                                const gradeTotal = gradeInfo?.count || 0;
                                const gradeWeekly = weeklyReturnees.filter(s => s.grade === grade).length;
                                const gradeDorm = gradeTotal - gradeWeekly;

                                return (
                                    <div key={grade} className="bg-white p-2 rounded-xl border border-gray-200/80 flex flex-col items-center text-center shadow-2xs">
                                        <span className="text-[11px] font-black text-gray-800">{grade}학년</span>
                                        <div className="flex items-center gap-0.5 mt-1 text-[11px]">
                                            <span className="text-orange-500 font-black">{gradeWeekly}</span>
                                            <span className="text-gray-300">/</span>
                                            <span className="text-gray-500 font-bold">{gradeTotal}</span>
                                        </div>
                                        <span className="text-[9px] text-blue-500 font-medium mt-0.5">기숙 {gradeDorm}</span>
                                    </div>
                                );
                            })}
                            <div className="bg-gray-900 text-white p-2 rounded-xl flex flex-col items-center text-center shadow-2xs">
                                <span className="text-[11px] font-black text-white">전학년</span>
                                <div className="flex items-center gap-0.5 mt-1 text-[11px]">
                                    <span className="text-orange-400 font-black">{weeklyReturnees.length}</span>
                                    <span className="text-gray-500">/</span>
                                    <span className="text-gray-300 font-bold">{stats.totalStudents}</span>
                                </div>
                                <span className="text-[9px] text-blue-300 font-medium mt-0.5">기숙 {stats.totalStudents - weeklyReturnees.length}</span>
                            </div>
                        </div>

                        <div className="px-4 pt-3 pb-2 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="이름 또는 학번 검색..."
                                value={viewMonthMode === 'current' ? currentMonthSearchQuery : nextMonthSearchQuery}
                                onChange={(e) => {
                                    if (viewMonthMode === 'current') {
                                        setCurrentMonthSearchQuery(e.target.value);
                                    } else {
                                        setNextMonthSearchQuery(e.target.value);
                                    }
                                }}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 transition"
                            />
                            {viewMonthMode === 'current' && (
                                <button
                                    onClick={() => setShowOnlyWeeklyCurrent(prev => !prev)}
                                    className={`whitespace-nowrap px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                                        showOnlyWeeklyCurrent
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    <span>매주귀가자만</span>
                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${showOnlyWeeklyCurrent ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                        {weeklyReturnees.length}명
                                    </span>
                                </button>
                            )}
                        </div>

                        <div className="p-4 max-h-[50vh] overflow-y-auto overflow-x-hidden">
                            {viewMonthMode === 'current' ? (() => {
                                const currentList = allRawStudents.filter(s => {
                                    const app = currentMonthApps.find(a => a.student_id === s.student_id);
                                    const isWeekly = app !== undefined ? app.is_weekly : !!s.weekend;
                                    if (showOnlyWeeklyCurrent && !isWeekly) return false;
                                    const query = currentMonthSearchQuery.trim().toLowerCase();
                                    if (query) {
                                        return s.name.toLowerCase().includes(query) || s.student_id.toLowerCase().includes(query);
                                    }
                                    return true;
                                }).sort((a, b) => a.student_id.localeCompare(b.student_id));

                                if (currentList.length === 0) {
                                    return <p className="text-gray-400 text-center text-xs py-4">검색 결과가 없습니다.</p>;
                                }

                                return (
                                    <div className="flex flex-col gap-1.5">
                                        {currentList.map((s) => {
                                            const app = currentMonthApps.find(a => a.student_id === s.student_id);
                                            const isWeekly = app !== undefined ? app.is_weekly : !!s.weekend;
                                            return (
                                                <div key={s.student_id} className={`flex items-center justify-between px-3 py-2 rounded-xl border transition ${
                                                    isWeekly ? 'bg-blue-50/50 border-blue-100' : 'bg-gray-50 border-gray-100'
                                                }`}>
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-bold text-gray-400 leading-none mb-0.5">{s.student_id}</span>
                                                        <span className="text-xs font-bold text-gray-800 flex items-center gap-1">
                                                            {s.name}
                                                            {isWeekly && (
                                                                <span className="text-[8px] font-black text-blue-600 bg-white px-1 py-0.5 rounded shadow-sm border border-blue-100">매주귀가</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                    {!readOnly ? (
                                                        <button
                                                            onClick={() => handleToggleCurrentMonthApp(s.student_id, isWeekly)}
                                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-sm transition active:scale-95 border ${
                                                                isWeekly
                                                                    ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                                                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            {isWeekly ? '매주귀가' : '격주귀가'}
                                                        </button>
                                                    ) : (
                                                        <span
                                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                                                                isWeekly
                                                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                    : 'bg-gray-100 text-gray-600 border-gray-200'
                                                            }`}
                                                        >
                                                            {isWeekly ? '매주귀가' : '격주귀가'}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })() : (() => {
                                const nextList = allRawStudents.filter(s => {
                                    const query = nextMonthSearchQuery.trim().toLowerCase();
                                    if (query) {
                                        return s.name.toLowerCase().includes(query) || s.student_id.toLowerCase().includes(query);
                                    }
                                    return true;
                                }).sort((a, b) => a.student_id.localeCompare(b.student_id));

                                if (nextList.length === 0) {
                                    return <p className="text-gray-400 text-center text-xs py-4">검색 결과가 없습니다.</p>;
                                }

                                return (
                                    <div className="flex flex-col gap-1.5">
                                        {nextList.map((s) => {
                                            const app = nextMonthApps.find(a => a.student_id === s.student_id);
                                            const isWeekly = app ? app.is_weekly : !!s.weekend;
                                            const isNew = app !== undefined && app.is_weekly && !s.weekend;
                                            const isExcluded = app !== undefined && !app.is_weekly && !!s.weekend;
                                            return (
                                                <div key={s.student_id} className={`flex items-center justify-between px-3 py-2 rounded-xl border transition ${
                                                    isWeekly
                                                        ? 'bg-blue-50/50 border-blue-100'
                                                        : isExcluded
                                                            ? 'bg-red-50/30 border-red-100/50'
                                                            : 'bg-gray-50 border-gray-100'
                                                }`}>
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-bold text-gray-400 leading-none mb-0.5">{s.student_id}</span>
                                                        <span className="text-xs font-bold text-gray-800 flex items-center gap-1">
                                                            {s.name}
                                                            {isNew && (
                                                                <span className="text-[8px] font-black text-blue-600 bg-white px-1 py-0.5 rounded shadow-sm border border-blue-100">신규</span>
                                                            )}
                                                            {isExcluded && (
                                                                <span className="text-[8px] font-black text-red-600 bg-white px-1 py-0.5 rounded shadow-sm border border-red-100">제외</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                    {!readOnly ? (
                                                        <button
                                                            onClick={() => handleToggleNextMonthApp(s.student_id, isWeekly)}
                                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-sm transition active:scale-95 border ${
                                                                isWeekly
                                                                    ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                                                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            {isWeekly ? '매주귀가' : '격주귀가'}
                                                        </button>
                                                    ) : (
                                                        <span
                                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                                                                isWeekly
                                                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                    : 'bg-gray-100 text-gray-600 border-gray-200'
                                                            }`}
                                                        >
                                                            {isWeekly ? '매주귀가' : '격주귀가'}
                                                        </span>
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

            {/* Overnight / Short Outing Student List Modal */}
            {/* Overnight / Short Outing Student List Modal */}
            {leaveListModal.isOpen && (() => {
                const targetLeaveType = leaveListModal.type === 'overnight' ? '외박' : '외출';
                const isTodayDate = isSameDay(new Date(), selectedDate);
                const nowTime = new Date();
                const startOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0);
                const endOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59);

                // 당일 활성화된 해당 종류(외박/외출)의 실제 신청 카드만 추출
                const targetRequests = allLeaveRequests.filter((l: any) => {
                    if (l.leave_type !== targetLeaveType) return false;
                    if (l.status !== '승인') return false;

                    if (isTodayDate) {
                        return nowTime >= new Date(l.start_time) && nowTime <= new Date(l.end_time);
                    }
                    return new Date(l.start_time) <= endOfDay && new Date(l.end_time) >= startOfDay;
                });

                const studentMap = new Map();
                allRawStudents.forEach(s => studentMap.set(s.student_id, s.name));

                const filtered = targetRequests.filter(req => {
                    const q = leaveModalSearchQuery.trim().toLowerCase();
                    if (!q) return true;
                    const mainId = (req.student_id || '').toLowerCase();
                    const mainName = (studentMap.get(req.student_id) || '').toLowerCase();
                    const subMatch = req.leave_request_students?.some((co: any) => {
                        const subId = (co.student_id || '').toLowerCase();
                        const subName = (studentMap.get(co.student_id) || '').toLowerCase();
                        return subId.includes(q) || subName.includes(q);
                    });
                    return mainId.includes(q) || mainName.includes(q) || subMatch;
                });

                const uniqueStudents = new Set<string>();
                targetRequests.forEach(req => {
                    if (req.student_id) uniqueStudents.add(req.student_id);
                    req.leave_request_students?.forEach((co: any) => {
                        if (co.student_id) uniqueStudents.add(co.student_id);
                    });
                });

                return (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
                        onClick={() => {
                            setLeaveListModal(prev => ({ ...prev, isOpen: false }));
                            setExpandedLeaveId(null);
                        }}
                    >
                        <div
                            className="w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden rounded-[24px] overscroll-contain"
                            style={{
                                background: "rgba(18, 18, 22, 0.78)",
                                backdropFilter: "blur(24px)",
                                WebkitBackdropFilter: "blur(24px)",
                                border: "1.5px solid rgba(255, 255, 255, 0.16)",
                                boxShadow: "0 25px 60px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.08)",
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Glass Header */}
                            <div className="p-4 px-5 border-b border-white/10 flex justify-between items-center bg-white/[0.03]">
                                <div className="flex items-center gap-2.5">
                                    <h3 className="font-extrabold text-base sm:text-lg text-white tracking-tight">{leaveListModal.title}</h3>
                                    <span className="bg-white/15 text-white/90 border border-white/20 px-2.5 py-0.5 rounded-full text-xs font-black shadow-sm">
                                        {uniqueStudents.size}명
                                    </span>
                                </div>
                                <button
                                    onClick={() => {
                                        setLeaveListModal(prev => ({ ...prev, isOpen: false }));
                                        setExpandedLeaveId(null);
                                    }}
                                    className="text-white/60 hover:text-white hover:bg-white/10 w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer text-sm font-bold"
                                    title="닫기"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Search Filter */}
                            <div className="p-3 px-5 border-b border-white/10 bg-white/[0.02] flex items-center gap-2">
                                <input
                                    type="text"
                                    placeholder="이름 또는 학번 검색..."
                                    value={leaveModalSearchQuery}
                                    onChange={(e) => setLeaveModalSearchQuery(e.target.value)}
                                    className="w-full bg-white/10 text-white placeholder-white/40 border border-white/15 rounded-xl px-3.5 py-2 text-xs outline-none focus:border-white/35 focus:bg-white/15 transition-all shadow-inner"
                                />
                            </div>

                            {/* Cards List */}
                            <div className="p-4 px-5 max-h-[60vh] overflow-y-auto overscroll-contain flex flex-col gap-3.5">
                                {filtered.length === 0 ? (
                                    <p className="text-white/50 text-center text-xs py-10 font-medium">해당하는 당일 {targetLeaveType} 기록이 없습니다.</p>
                                ) : (
                                    filtered.map((req) => (
                                        <LeaveProcessCard
                                            key={req.id}
                                            req={req as LeaveRequest}
                                            isExpanded={expandedLeaveId === req.id}
                                            onToggleExpand={() => setExpandedLeaveId(expandedLeaveId === req.id ? null : req.id)}
                                            isMenuOpen={false}
                                            onToggleMenu={(e) => e.stopPropagation()}
                                            onUpdateStatus={() => {}}
                                            onCancel={() => {}}
                                            viewMode="active"
                                            currentTeacherId=""
                                            hideActionButtons={true}
                                        />
                                    ))
                                )}
                            </div>

                            {/* Glass Footer */}
                            <div className="p-3 px-5 border-t border-white/10 bg-white/[0.03] flex justify-end">
                                <button
                                    onClick={() => {
                                        setLeaveListModal(prev => ({ ...prev, isOpen: false }));
                                        setExpandedLeaveId(null);
                                    }}
                                    className="w-full sm:w-auto px-6 py-2 bg-white/15 hover:bg-white/25 text-white font-bold text-xs rounded-xl transition-all cursor-pointer border border-white/20 active:scale-95 shadow-sm"
                                >
                                    닫기
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
