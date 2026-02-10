'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import clsx from 'clsx';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

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

interface StudyRoomMonitorProps {
    roomId: number;
}

export function StudyRoomMonitor({ roomId }: StudyRoomMonitorProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [students, setStudents] = useState<Student[]>([]);
    const [assignments, setAssignments] = useState<SeatAssignment[]>([]);
    const [seatProperties, setSeatProperties] = useState<SeatProperty[]>([]);
    const [layout, setLayout] = useState<RoomLayout>({ room_number: roomId, columns: 6, total_seats: 30 });
    const [activeLeaves, setActiveLeaves] = useState<any[]>([]);
    const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
    const [specialHolidays, setSpecialHolidays] = useState<string[]>([]);
    const [weeklyReturnStudents, setWeeklyReturnStudents] = useState<Set<string>>(new Set());
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        fetchCommonData();
        // Clock for Monitor Mode - 1 second precision
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (roomId) {
            fetchRoomData(roomId);
            fetchLiveStatus();

            const channel = supabase
                .channel('monitor_leave_changes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
                    fetchLiveStatus();
                })
                .subscribe();

            const refreshTimer = setInterval(() => fetchLiveStatus(), 30000);

            return () => {
                supabase.removeChannel(channel);
                clearInterval(refreshTimer);
            };
        }
    }, [roomId]);

    async function fetchCommonData() {
        const { data: studentsData } = await supabase.from('students').select('*').order('student_id');
        if (studentsData) setStudents(studentsData);

        const { data: timetableData } = await supabase.from('timetable_entries').select('*');
        if (timetableData) setTimetable(timetableData);

        const { data: holidayData } = await supabase.from('special_holidays').select('date');
        if (holidayData) setSpecialHolidays(holidayData.map(h => h.date));

        // Fetch Weekly Return Students (Monthly Application)
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        const { data: returnData } = await supabase
            .from('monthly_return_applications')
            .select('student_id')
            .eq('target_year', currentYear)
            .eq('target_month', currentMonth);

        if (returnData) {
            const ids = new Set(returnData.map(r => r.student_id));
            setWeeklyReturnStudents(ids);
        }
    }

    async function fetchLiveStatus() {
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

    async function fetchRoomData(roomNum: number) {
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
        <div className="w-full h-full bg-gray-100 flex flex-col">
            <Toaster />

            <div className="flex-1 overflow-hidden relative">
                <TransformWrapper
                    initialScale={1}
                    minScale={0.5}
                    maxScale={3}
                    centerOnInit
                    limitToBounds={false}
                >
                    <TransformComponent wrapperClass="w-full h-full" contentClass="w-full h-full flex items-center justify-center p-10">
                        <div className="bg-white p-8 rounded-2xl shadow-xl border-4 border-gray-800 relative">
                            {/* Screen/Door Indicator (Top) */}
                            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-8 py-1 rounded-b-lg font-bold text-sm shadow-md">
                                FRONT / DOOR
                            </div>

                            {isLoading ? (
                                <div className="flex items-center justify-center h-64 w-96">
                                    <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <div className="w-full">
                                    {/* Period Headers */}
                                    {activePeriods.length > 0 && (
                                        <div
                                            className="grid gap-0 text-left w-full border-b-2 border-gray-100 mb-0"
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

                                    {/* Seat Grid */}
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

                                            // Determine Seat Colors
                                            let seatStatusColor = "bg-white";
                                            let isAwayBlinking = false;

                                            let headerBgClass = "bg-white";
                                            let studentIdTextColor = "text-gray-800";

                                            const isWeeklyHome = (assignment?.student?.weekend || weeklyReturnStudents.has(assignment?.student_id || '')) && isWeeklyHomeTime(currentTime);

                                            if (assignment && activeLeaves.length > 0) {
                                                const awayReq = activeLeaves.find(req =>
                                                    (req.student_id === assignment.student_id || req.leave_request_students?.some((s: any) => s.student_id === assignment.student_id)) &&
                                                    req.leave_type === '자리비움' &&
                                                    new Date(req.start_time) <= currentTime &&
                                                    new Date(req.end_time) >= currentTime
                                                );
                                                if (awayReq) {
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
                                                <div key={seatNum} className={clsx(
                                                    "relative flex flex-col border-r border-b border-gray-200 overflow-hidden",
                                                    isDisabled ? "bg-gray-300" : "bg-white",
                                                    !assignment && !isDisabled && "bg-gray-50/50",
                                                    "w-full h-[54px]",
                                                    isAwayBlinking && "animate-[pulse_1s_infinite] bg-red-100",
                                                    isWeeklyHome && "bg-gray-400/20"
                                                )}>
                                                    {!isDisabled && (
                                                        <span className={clsx(
                                                            "absolute top-0.5 right-1 text-[9px] font-bold z-10",
                                                            assignment ? "text-gray-300" : "text-gray-400"
                                                        )}>
                                                            {seatNum}
                                                        </span>
                                                    )}

                                                    {assignment ? (
                                                        <>
                                                            <div className={clsx(
                                                                "flex-[2] flex items-center justify-center font-bold text-sm tracking-tight relative overflow-hidden",
                                                                headerBgClass,
                                                                studentIdTextColor
                                                            )}>
                                                                {assignment.student?.name}
                                                            </div>
                                                            <div className="h-5 border-t border-gray-100 flex divide-x divide-gray-100 bg-gray-50">
                                                                {activePeriods.map((period) => {
                                                                    const status = getPeriodStatus(period.id, assignment, activeLeaves);
                                                                    let cellClass = "bg-transparent";
                                                                    if (status.status === 'active') {
                                                                        switch (status.type) {
                                                                            case '컴이석': cellClass = "bg-blue-400"; break;
                                                                            case '이석': cellClass = "bg-orange-400"; break;
                                                                            case '외출': cellClass = "bg-green-400"; break;
                                                                            case '외박': cellClass = "bg-purple-400"; break;
                                                                            case '자리비움': cellClass = "bg-red-500"; break;
                                                                        }
                                                                    } else if (status.status === 'past') {
                                                                        cellClass = "bg-gray-200";
                                                                    }

                                                                    if (isWeeklyHome && status.status !== 'past') {
                                                                        cellClass = "bg-gray-400";
                                                                    }

                                                                    return (
                                                                        <div key={period.id} className={clsx("flex-1", cellClass)}></div>
                                                                    )
                                                                })}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="flex-1 flex items-center justify-center text-xs text-gray-300 font-bold">
                                                            빈 자리
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </TransformComponent>
                </TransformWrapper>
            </div>

            {/* Legend (Fixed Bottom) */}
            <div className="bg-white border-t border-gray-200 p-3 flex justify-center gap-4 text-xs font-bold text-gray-600 shadow-lg z-10">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-200 border border-blue-300 rounded-sm"></div>컴퓨터</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-orange-200 border border-orange-300 rounded-sm"></div>자습실이석</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-200 border border-green-300 rounded-sm"></div>외출</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-purple-200 border border-purple-300 rounded-sm"></div>외박</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-500 border border-red-600 rounded-sm"></div>자리비움</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-gray-500 border border-gray-600 rounded-sm"></div>금요귀가</div>
            </div>
        </div>
    );
}
