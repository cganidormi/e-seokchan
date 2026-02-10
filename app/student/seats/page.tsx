'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';

interface Student {
    student_id: string;
    name: string;
    grade: number;
    class: number;
    weekend?: boolean;
}

interface SeatAssignment {
    id?: number;
    room_number: number;
    seat_number: number;
    student_id: string | null;
    student?: Student;
}

interface SeatProperty {
    room_number: number;
    seat_number: number;
    is_disabled: boolean;
}

interface RoomLayout {
    room_number: number;
    columns: number;
    total_seats: number;
}

interface TimetableEntry {
    id: number;
    day_type: string;
    description: string;
    start_time: string;
    end_time: string;
}

const isWeeklyHomeTime = (date: Date) => {
    const day = date.getDay();
    const hour = date.getHours();
    const minute = date.getMinutes();

    // Friday (5) >= 17:00
    if (day === 5) {
        return hour >= 17;
    }
    // Saturday (6) - All day
    if (day === 6) {
        return true;
    }
    // Sunday (0) <= 18:50
    if (day === 0) {
        if (hour < 18) return true;
        if (hour === 18 && minute <= 50) return true;
        return false;
    }
    return false;
};

export default function StudentSeatPage() {
    const router = useRouter();
    const [selectedRoom, setSelectedRoom] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [assignments, setAssignments] = useState<SeatAssignment[]>([]);
    const [seatProperties, setSeatProperties] = useState<SeatProperty[]>([]);
    const [layout, setLayout] = useState<RoomLayout>({ room_number: 1, columns: 6, total_seats: 30 });
    const [activeLeaves, setActiveLeaves] = useState<any[]>([]);
    const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
    const [specialHolidays, setSpecialHolidays] = useState<string[]>([]);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [studentId, setStudentId] = useState<string | null>(null);

    useEffect(() => {
        // Permissions Check
        const loginId = localStorage.getItem('dormichan_login_id') || sessionStorage.getItem('dormichan_login_id');
        const role = localStorage.getItem('dormichan_role') || sessionStorage.getItem('dormichan_role');

        if (!loginId || (role !== 'student' && role !== 'monitor')) {
            router.replace('/login');
            return;
        }
        setStudentId(loginId);

        fetchCommonData();

        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, [router]);

    useEffect(() => {
        if (!studentId) return;

        fetchRoomData(selectedRoom);
        fetchLiveStatus(selectedRoom);

        // Subscribe to real-time changes
        const channel = supabase
            .channel('student_monitor_leave_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
                fetchLiveStatus(selectedRoom);
            })
            .subscribe();

        // Auto-refresh every 30 seconds as a fallback
        const refreshTimer = setInterval(() => fetchLiveStatus(selectedRoom), 30000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(refreshTimer);
        };
    }, [selectedRoom, studentId]);

    const fetchCommonData = async () => {
        const { data: timetableData } = await supabase.from('timetable_entries').select('*');
        if (timetableData) setTimetable(timetableData);

        const { data: holidayData } = await supabase.from('special_holidays').select('date');
        if (holidayData) setSpecialHolidays(holidayData.map(h => h.date));
    };

    const fetchLiveStatus = async (roomNum: number) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data } = await supabase
            .from('leave_requests')
            .select('*, leave_request_students(student_id)')
            .in('status', ['승인', '신청'])
            .gte('end_time', today.toISOString());

        if (data) {
            const filteredData = data.filter(req => {
                if (req.leave_type === '컴이석') return true;
                return req.status === '승인';
            });
            setActiveLeaves(filteredData);
        }
    };

    const fetchRoomData = async (roomNum: number) => {
        setIsLoading(true);
        try {
            // Fetch Layout
            const { data: layoutData } = await supabase
                .from('room_layouts')
                .select('*')
                .eq('room_number', roomNum)
                .single();

            if (layoutData) {
                setLayout(layoutData);
            } else {
                const defaultLayout = { room_number: roomNum, columns: 6, total_seats: 30 };
                setLayout(defaultLayout);
            }

            // Fetch Assignments
            const { data: seatData } = await supabase
                .from('seat_assignments')
                .select('*, student:students(*)')
                .eq('room_number', roomNum);

            if (seatData) {
                setAssignments(seatData);
            } else {
                setAssignments([]);
            }

            // Fetch Seat Properties (Disabled Status)
            const { data: propData } = await supabase
                .from('seats')
                .select('*')
                .eq('room_number', roomNum);

            if (propData) {
                setSeatProperties(propData);
            } else {
                setSeatProperties([]);
            }
        } catch (error) {
            console.error('Error fetching room data:', error);
            toast.error('데이터를 불러오는 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    // --- Period Logic ---
    // [DEBUG] TEMPORARY: Force Weekday Afternoon (Monday 14:00) for UI Verification
    // const day = 1; // Monday
    // const dateStr = '2024-05-20'; // Random weekday
    // const isHoliday = false;
    // const currentHHmm = '14:00';
    const day = currentTime.getDay();
    const dateStr = currentTime.toLocaleDateString('en-CA');
    const isHoliday = (day === 0 || day === 6) || specialHolidays.includes(dateStr);
    const currentHHmm = currentTime.getHours().toString().padStart(2, '0') + ':' + currentTime.getMinutes().toString().padStart(2, '0');

    let activePeriods: { p: string, id: number }[] = [];

    if (timetable.length > 0) {
        const typeFilter = isHoliday ? 'weekend' : 'weekday';
        const dayPeriods = timetable
            .filter(t => t.day_type.includes(typeFilter) && /\bday\b/.test(t.day_type))
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
            .map(t => ({ p: t.description.replace(/[^0-9]/g, ''), id: t.id }));

        const nightPeriods = timetable
            .filter(t => t.day_type.includes(typeFilter) && t.day_type.includes('night'))
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
            .map(t => ({ p: t.description.replace(/[^0-9]/g, ''), id: t.id }));

        const morningPeriods = isHoliday ? timetable
            .filter(t => t.day_type.includes('weekend morning'))
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
            .map(t => ({ p: t.description.replace(/[^0-9]/g, ''), id: t.id })) : [];

        if (isHoliday) {
            if (currentHHmm < '13:00' && morningPeriods.length > 0) { activePeriods = morningPeriods; }
            else if (currentHHmm < '18:30') { activePeriods = dayPeriods; }
            else { activePeriods = nightPeriods; }
        } else {
            if (currentHHmm < '19:00') {
                // Filter 6~9 Period only for Weekday Daytime
                activePeriods = dayPeriods.filter(p => ['6', '7', '8', '9'].includes(p.p));
            }
            else { activePeriods = nightPeriods; }
        }

        if (activePeriods.length === 0) {
            if (dayPeriods.length > 0) {
                activePeriods = isHoliday ? dayPeriods : dayPeriods.filter(p => ['6', '7', '8', '9'].includes(p.p));
            }
        }
    }

    const getPeriodStatus = (periodId: number, assignment: SeatAssignment | undefined, activeLeaves: any[]) => {
        const entry = timetable.find(t => t.id === periodId);
        if (!entry) return { status: 'future', type: null };

        const entryEndTime = entry.end_time.substring(0, 5);
        const isPast = currentHHmm > entryEndTime;

        if (assignment && activeLeaves.length > 0) {
            const studentLeaves = activeLeaves.filter(req =>
                (req.student_id === assignment.student_id || req.leave_request_students?.some((s: any) => s.student_id === assignment.student_id))
            );

            for (const leave of studentLeaves) {
                if (leave.period) {
                    const leaveDigits = (leave.period || "").match(/\d+/g) || [];
                    const entryDigits = (entry.description || "").match(/\d+/g) || [];
                    if (leaveDigits.length > 0 && entryDigits.length > 0 && leaveDigits.some((d: string) => (entryDigits as string[]).includes(d))) {
                        return { status: isPast ? 'past' : 'active', type: leave.leave_type };
                    }
                }

                if (leave.leave_type === '외출' || leave.leave_type === '외박' || leave.leave_type === '자리비움') {
                    const lStart = new Date(leave.start_time);
                    const lEnd = new Date(leave.end_time);

                    const pStart = new Date(currentTime);
                    const [sh, sm] = entry.start_time.split(':').map(Number);
                    pStart.setHours(sh, sm, 0, 0);
                    const pEnd = new Date(currentTime);
                    const [eh, em] = entry.end_time.split(':').map(Number);
                    pEnd.setHours(eh, em, 0, 0);

                    if (lStart < pEnd && lEnd > pStart) {
                        if (leave.leave_type === '자리비움') {
                            const now = new Date();
                            if (now >= lStart && now <= lEnd && currentHHmm >= entry.start_time.substring(0, 5) && currentHHmm <= entry.end_time.substring(0, 5)) {
                                return { status: 'active', type: '자리비움' };
                            }
                        } else {
                            return { status: isPast ? 'past' : 'active', type: leave.leave_type };
                        }
                    }
                }
            }
        }
        if (isPast) return { status: 'past', type: null };
        return { status: 'future', type: null };
    };

    return (
        <div className="p-4 md:p-6 bg-gray-100 min-h-screen">
            <Toaster />

            <div className="flex flex-col w-full max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex flex-col gap-4 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-6 bg-yellow-400 rounded-full"></div>
                            <h1 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
                                제 {selectedRoom} 실 현황 모니터
                                <select
                                    value={selectedRoom}
                                    onChange={(e) => setSelectedRoom(Number(e.target.value))}
                                    className="ml-2 bg-transparent text-sm font-bold text-gray-400 focus:outline-none cursor-pointer hover:text-gray-600 transition-colors"
                                >
                                    <option value={1}>(1실 변경)</option>
                                    <option value={2}>(2실 변경)</option>
                                    <option value={3}>(3실 변경)</option>
                                </select>
                            </h1>
                        </div>
                    </div>

                    {localStorage.getItem('dormichan_role') !== 'monitor' && (
                        <button
                            onClick={() => router.push('/student')}
                            className="w-full py-3 rounded-xl text-sm font-bold transition-all text-yellow-800 bg-yellow-400 hover:bg-yellow-300 shadow-sm"
                        >
                            ← 학생 홈으로 돌아가기
                        </button>
                    )}
                </div>

                {/* Seat Grid */}
                <div className="min-h-[500px]">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="w-full">
                            {/* Sticky Header Row */}
                            {activePeriods.length > 0 && (
                                <div
                                    className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b-2 border-gray-100 shadow-sm grid gap-0 text-left w-full"
                                    style={{
                                        gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`
                                    }}
                                >
                                    {Array.from({ length: layout.columns }).map((_, colIdx) => (
                                        <div key={`header-${colIdx}`} className="p-1 h-[24px] flex items-center bg-gray-50 border-r border-gray-100 last:border-r-0">
                                            <div className="w-full flex h-full items-center text-[10px] text-gray-400 font-bold divide-x divide-gray-200">
                                                {activePeriods.map((p) => (
                                                    <div key={p.id} className="flex-1 text-center flex items-center justify-center">
                                                        {p.p}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div
                                className="grid gap-0 text-left w-full border-t border-l border-gray-200"
                                style={{
                                    gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`
                                }}
                            >
                                {Array.from({ length: layout.total_seats }).map((_, idx) => {
                                    const seatNum = idx + 1;
                                    const assignment = assignments.find(a => a.seat_number === seatNum);
                                    const isDisabled = seatProperties.find(p => p.seat_number === seatNum)?.is_disabled;

                                    const disabledCountBefore = seatProperties.filter(p => p.seat_number < seatNum && p.is_disabled).length;
                                    const displaySeatNum = seatNum - disabledCountBefore;

                                    let seatStatusColor = "bg-white";
                                    let isAwayBlinking = false;
                                    let activeLeaveReq: any = null;

                                    let headerBgClass = "bg-white";
                                    let studentIdTextColor = "text-gray-800";

                                    const isWeeklyHome = assignment?.student?.weekend && isWeeklyHomeTime(currentTime);

                                    if (assignment && activeLeaves.length > 0) {
                                        const awayReq = activeLeaves.find(req =>
                                            (req.student_id === assignment.student_id || req.leave_request_students?.some((s: any) => s.student_id === assignment.student_id)) &&
                                            req.leave_type === '자리비움' &&
                                            new Date(req.start_time) <= currentTime &&
                                            new Date(req.end_time) >= currentTime
                                        );
                                        if (awayReq) {
                                            activeLeaveReq = awayReq;
                                            const diffMins = (currentTime.getTime() - new Date(awayReq.start_time).getTime()) / 60000;
                                            seatStatusColor = "bg-red-500";
                                            if (diffMins >= 10) isAwayBlinking = true;
                                        }

                                        const currentActiveLeave = activeLeaves.find(leave => {
                                            const isTarget = (leave.student_id === assignment.student_id || leave.leave_request_students?.some((s: any) => s.student_id === assignment.student_id));
                                            if (!isTarget) return false;
                                            const start = new Date(leave.start_time);
                                            const end = new Date(leave.end_time);
                                            return currentTime >= start && currentTime <= end;
                                        });

                                        if (currentActiveLeave) {
                                            switch (currentActiveLeave.leave_type) {
                                                case '컴이석': headerBgClass = "bg-blue-200"; studentIdTextColor = "text-blue-800"; break;
                                                case '이석': headerBgClass = "bg-orange-200"; studentIdTextColor = "text-orange-800"; break;
                                                case '외출': headerBgClass = "bg-green-200"; studentIdTextColor = "text-green-800"; break;
                                                case '외박': headerBgClass = "bg-purple-200"; studentIdTextColor = "text-purple-800"; break;
                                            }
                                        }
                                    }

                                    if (isWeeklyHome) {
                                        headerBgClass = "bg-gray-500";
                                        studentIdTextColor = "text-white";
                                    }

                                    if (isDisabled) {
                                        return (
                                            <div key={seatNum} className="relative w-full h-[54px] bg-gray-300 border-r border-b border-gray-200"></div>
                                        );
                                    }

                                    return (
                                        <div key={seatNum} className="relative group">
                                            <div
                                                className={clsx(
                                                    "relative flex flex-col border-r border-b border-gray-200 overflow-hidden transition-all",
                                                    isDisabled ? "bg-gray-300" : "bg-white",
                                                    !assignment && !isDisabled && "bg-gray-50/50",
                                                    "w-full h-[54px]",
                                                    activeLeaveReq?.leave_type === '자리비움' && !isAwayBlinking && "bg-red-50",
                                                    isAwayBlinking && "animate-[pulse_1s_infinite] bg-red-100",
                                                    isWeeklyHome && "bg-gray-400/20"
                                                )}
                                            >
                                                {!isDisabled && (
                                                    <span className={clsx(
                                                        "absolute top-0.5 right-1 text-[8px] font-medium select-none z-20",
                                                        activeLeaveReq?.leave_type === '자리비움' ? "text-white/80" : "text-gray-300"
                                                    )}>
                                                        {displaySeatNum}
                                                    </span>
                                                )}

                                                {isDisabled ? (
                                                    <div className="flex-1"></div>
                                                ) : assignment ? (
                                                    <>
                                                        <div className={clsx(
                                                            "flex-1 flex items-center px-1.5 border-b border-gray-100 transition-colors",
                                                            activeLeaveReq?.leave_type === '자리비움' ? (isAwayBlinking ? "bg-red-600" : "bg-red-500") : headerBgClass
                                                        )}>
                                                            <span className={clsx("text-[11px] truncate font-medium flex-1", activeLeaveReq?.leave_type === '자리비움' ? "text-white" : studentIdTextColor)}>
                                                                {assignment.student?.student_id}
                                                                {activeLeaveReq?.leave_type === '자리비움' && <span className="text-[9px] ml-1 font-normal">자리비움</span>}
                                                                {isWeeklyHome && <span className="text-[9px] ml-auto font-normal text-white/90">귀가</span>}
                                                            </span>
                                                        </div>

                                                        <div className="h-5 flex bg-gray-50/30">
                                                            {activePeriods.map((periodObj) => {
                                                                const { status, type } = getPeriodStatus(periodObj.id, assignment, activeLeaves);

                                                                let blockClass = "";
                                                                let textClass = "text-transparent";
                                                                let content: React.ReactNode = periodObj.p;

                                                                if (status === 'active' && type) {
                                                                    textClass = "font-bold text-[10px]";
                                                                    switch (type) {
                                                                        case '컴이석':
                                                                            blockClass = "bg-blue-200";
                                                                            textClass = "text-blue-700";
                                                                            content = '컴';
                                                                            break;
                                                                        case '이석':
                                                                            blockClass = "bg-orange-200";
                                                                            textClass = "text-orange-700";
                                                                            content = '이';
                                                                            break;
                                                                        case '외출':
                                                                            blockClass = "bg-green-200";
                                                                            textClass = "text-green-800";
                                                                            content = '출';
                                                                            break;
                                                                        case '외박':
                                                                            blockClass = "bg-purple-200";
                                                                            textClass = "text-purple-700";
                                                                            content = '박';
                                                                            break;
                                                                        case '자리비움':
                                                                            blockClass = isAwayBlinking ? "bg-red-600" : "bg-red-500";
                                                                            textClass = "text-white";
                                                                            content = '비';
                                                                            break;
                                                                    }
                                                                } else if (status === 'past') {
                                                                    blockClass = "bg-gray-300";
                                                                }

                                                                return (
                                                                    <div key={periodObj.id} className={clsx("flex-1 flex items-center justify-center text-[10px] border-r border-gray-100 last:border-r-0", blockClass, status === 'active' && "border-r-white")}>
                                                                        <span className={textClass}>{content}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="flex-1 flex items-center justify-center">
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
