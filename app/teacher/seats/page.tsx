'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { supabase } from '@/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import clsx from 'clsx';
import Select from 'react-select';

interface Student {
    student_id: string;
    name: string;
    grade: number;
    class: number;
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

export default function SeatManagementPage() {
    const [selectedRoom, setSelectedRoom] = useState(1);
    const [mode, setMode] = useState<'monitor' | 'edit'>('monitor'); // 'monitor' | 'edit'
    const [isLoading, setIsLoading] = useState(true);
    const [students, setStudents] = useState<Student[]>([]);
    const [assignments, setAssignments] = useState<SeatAssignment[]>([]);
    const [seatProperties, setSeatProperties] = useState<SeatProperty[]>([]); // Added state
    const [layout, setLayout] = useState<RoomLayout>({ room_number: 1, columns: 6, total_seats: 30 });
    const [activeLeaves, setActiveLeaves] = useState<any[]>([]);
    const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
    const [specialHolidays, setSpecialHolidays] = useState<string[]>([]);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Edit Mode for Layout
    const [isEditingLayout, setIsEditingLayout] = useState(false);
    const [tempLayout, setTempLayout] = useState<RoomLayout>({ ...layout });

    // Student Selection Modal
    const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        fetchCommonData();
        // Clock for Monitor Mode - 1 second precision for "Real-time" feel
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetchRoomData(selectedRoom);
        if (mode === 'monitor') {
            fetchLiveStatus(selectedRoom);

            // Subscribe to real-time changes
            const channel = supabase
                .channel('monitor_leave_changes')
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
        }
    }, [selectedRoom, mode]);

    const fetchCommonData = async () => {
        const { data: studentsData } = await supabase.from('students').select('*').order('student_id');
        if (studentsData) setStudents(studentsData);

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
            .in('status', ['승인', '신청']) // Fetch both Approved and Pending
            .gte('end_time', today.toISOString());

        if (data) setActiveLeaves(data);
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
                setTempLayout(layoutData);
            } else {
                // Default layout if not found
                const defaultLayout = { room_number: roomNum, columns: 6, total_seats: 30 };
                setLayout(defaultLayout);
                setTempLayout(defaultLayout);
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

    const saveLayout = async () => {
        try {
            const { error } = await supabase
                .from('room_layouts')
                .upsert(tempLayout, { onConflict: 'room_number' });

            if (error) throw error;

            setLayout(tempLayout);
            setIsEditingLayout(false);
            toast.success('배치 설정이 저장되었습니다.');
        } catch (error: any) {
            console.error('Error saving layout:', error);
            toast.error(`설정 저장 실패: ${error.message || '알 수 없는 오류'}`);
        }
    };

    const assignStudent = async (studentId: string | null) => {
        if (selectedSeat === null) return;

        try {
            const payload = {
                room_number: selectedRoom,
                seat_number: selectedSeat,
                student_id: studentId
            };

            const existing = assignments.find(a => a.seat_number === selectedSeat);

            if (studentId) {
                const { error } = await supabase
                    .from('seat_assignments')
                    .upsert(payload, { onConflict: 'room_number, seat_number' } as any);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('seat_assignments')
                    .delete()
                    .eq('room_number', selectedRoom)
                    .eq('seat_number', selectedSeat);

                if (error) throw error;
            }

            toast.success(studentId ? '학생이 배정되었습니다.' : '배정이 해제되었습니다.');
            fetchRoomData(selectedRoom); // Refresh
            setIsModalOpen(false);
            setSelectedSeat(null);

        } catch (error) {
            console.error('Error assigning student:', error);
            toast.error('학생 배정 실패');
        }
    };

    const resetAllSeats = async () => {
        if (!confirm(`${selectedRoom}실의 모든 좌석 배정을 초기화하시겠습니까?`)) return;

        try {
            const { error } = await supabase
                .from('seat_assignments')
                .delete()
                .eq('room_number', selectedRoom);

            if (error) throw error;

            toast.success('초기화되었습니다.');
            fetchRoomData(selectedRoom);
        } catch (err) {
            toast.error('초기화 실패');
        }
    }

    const toggleSeatDisabled = async (seatNum: number | null) => {
        if (seatNum === null) return;

        const currentProp = seatProperties.find(p => p.seat_number === seatNum);
        const newDisabledStatus = !currentProp?.is_disabled;

        try {
            const { error } = await supabase
                .from('seats')
                .upsert({
                    room_number: selectedRoom,
                    seat_number: seatNum,
                    is_disabled: newDisabledStatus
                }, { onConflict: 'room_number, seat_number' } as any);

            if (error) throw error;

            // Update Local State
            setSeatProperties(prev => {
                const existing = prev.find(p => p.seat_number === seatNum);
                if (existing) {
                    return prev.map(p => p.seat_number === seatNum ? { ...p, is_disabled: newDisabledStatus } : p);
                } else {
                    return [...prev, { room_number: selectedRoom, seat_number: seatNum, is_disabled: newDisabledStatus }];
                }
            });

            // If disabling, also remove assignment if exists
            if (newDisabledStatus) {
                const existingAssignment = assignments.find(a => a.seat_number === seatNum);
                if (existingAssignment) {
                    await supabase.from('seat_assignments').delete().eq('id', existingAssignment.id);
                    setAssignments(prev => prev.filter(a => a.seat_number !== seatNum));
                }
            }

            toast.success(newDisabledStatus ? '좌석이 비활성화되었습니다.' : '좌석이 활성화되었습니다.');
            setIsModalOpen(false); // Close modal if open

        } catch (err) {
            console.error('Error toggling disabled status:', err);
            toast.error('상태 변경 실패');
        }
    };

    return (
        <div className="p-4 md:p-6 bg-gray-100 min-h-screen">
            <Toaster />

            <div className="flex flex-col w-full max-w-6xl mx-auto">
                {/* Header & Controls */}
                {/* Header & Controls */}
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

                        {/* Seat Management Toggle (Compact - Top Right) */}
                        <button
                            onClick={() => setMode(mode === 'edit' ? 'monitor' : 'edit')}
                            className={clsx(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1",
                                mode === 'edit' ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            )}
                        >
                            <span>{mode === 'edit' ? '모니터로 돌아가기' : '⚙️ 좌석 관리'}</span>
                        </button>
                    </div>

                    {/* Full Width Leave List Button */}
                    <button
                        onClick={() => window.location.href = '/teacher'}
                        className="w-full py-3 rounded-xl text-sm font-bold transition-all text-yellow-800 bg-yellow-400 hover:bg-yellow-300 shadow-sm"
                    >
                        ← 이석현황 목록으로 돌아가기
                    </button>
                </div>

                {/* Layout Settings (Only in Edit Mode) */}
                {mode === 'edit' && (
                    <div className="bg-white p-6 rounded-3xl shadow-sm mb-6 border border-gray-100 animate-in slide-in-from-top-2">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-gray-700 flex items-center gap-2">
                                <span>⚙️ 구조 설정</span>
                                <span className="text-xs font-normal text-gray-400">(열 개수와 총 좌석 수를 설정하세요)</span>
                            </h2>
                            <div className="flex gap-2">
                                {!isEditingLayout ? (
                                    <button
                                        onClick={() => setIsEditingLayout(true)}
                                        className="px-4 py-2 bg-gray-100 rounded-xl text-gray-600 font-bold text-sm hover:bg-gray-200 transition-colors"
                                    >
                                        설정 수정
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={saveLayout}
                                            className="px-4 py-2 bg-blue-500 rounded-xl text-white font-bold text-sm hover:bg-blue-600 transition-colors shadow-blue-200 shadow-lg"
                                        >
                                            저장
                                        </button>
                                        <button
                                            onClick={() => { setIsEditingLayout(false); setTempLayout(layout); }}
                                            className="px-4 py-2 bg-gray-100 rounded-xl text-gray-600 font-bold text-sm hover:bg-gray-200 transition-colors"
                                        >
                                            취소
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-6">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-400">한 줄에 몇 명?</label>
                                <input
                                    type="number"
                                    disabled={!isEditingLayout}
                                    value={tempLayout.columns}
                                    onChange={e => setTempLayout({ ...tempLayout, columns: parseInt(e.target.value) || 1 })}
                                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 w-32 font-bold text-gray-700 focus:outline-none focus:border-yellow-400 transition-all disabled:opacity-50"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-400">총 좌석 수</label>
                                <input
                                    type="number"
                                    disabled={!isEditingLayout}
                                    value={tempLayout.total_seats}
                                    onChange={e => setTempLayout({ ...tempLayout, total_seats: parseInt(e.target.value) || 1 })}
                                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 w-32 font-bold text-gray-700 focus:outline-none focus:border-yellow-400 transition-all disabled:opacity-50"
                                />
                            </div>
                            <div className="ml-auto flex items-end">
                                <button
                                    onClick={resetAllSeats}
                                    className="text-red-400 font-bold text-xs underline hover:text-red-600 p-2"
                                >
                                    ⚠️ 이 열람실 배정 초기화
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Seat Grid */}
                <div className="min-h-[500px]">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="w-full">
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

                                    // Calculate Display Number (Visual Seat Number)
                                    // Count how many disabled seats exist with seat_number < current seatNum
                                    const disabledCountBefore = seatProperties.filter(p => p.seat_number < seatNum && p.is_disabled).length;
                                    const displaySeatNum = seatNum - disabledCountBefore;

                                    // --- Monitor Mode Variables ---
                                    let seatStatusColor = "bg-[#e0e5ec]"; // Neumorphic base
                                    let isAwayBlinking = false;
                                    let activeLeaveReq: any = null; // For seat-level click actions (Away)

                                    // Period Config (Database Driven)
                                    const day = currentTime.getDay();
                                    const dateStr = currentTime.toLocaleDateString('en-CA'); // YYYY-MM-DD
                                    const isHoliday = (day === 0 || day === 6) || specialHolidays.includes(dateStr);
                                    const currentHHmm = currentTime.getHours().toString().padStart(2, '0') + ':' + currentTime.getMinutes().toString().padStart(2, '0');

                                    let periodGroups: { label: string, periods: string[] }[] = [];

                                    if (timetable.length > 0) {
                                        const typeFilter = isHoliday ? 'weekend' : 'weekday';
                                        const dayPeriods = timetable
                                            .filter(t => t.day_type.includes(typeFilter) && t.day_type.includes('day'))
                                            .sort((a, b) => a.start_time.localeCompare(b.start_time))
                                            .map(t => ({ label: isHoliday ? '오후' : '주간', p: t.description.replace(/[^0-9]/g, '') }));

                                        const nightPeriods = timetable
                                            .filter(t => t.day_type.includes(typeFilter) && t.day_type.includes('night'))
                                            .sort((a, b) => a.start_time.localeCompare(b.start_time))
                                            .map(t => ({ label: '야간', p: t.description.replace(/[^0-9]/g, '') }));

                                        // Weekends might have morning too
                                        const morningPeriods = isHoliday ? timetable
                                            .filter(t => t.day_type.includes('weekend morning')) // hypothetical, but handle if any
                                            .sort((a, b) => a.start_time.localeCompare(b.start_time))
                                            .map(t => ({ label: '오전', p: t.description.replace(/[^0-9]/g, '') })) : [];

                                        // Pick the most relevant group based on current hour
                                        // Simplified: show the group that is currently active or upcoming
                                        // For Weekday: if before 18:00 show Day, else Night
                                        // For Weekend: if before 12:00 show Morning, 12-18 Afternoon, else Night
                                        const hour = currentTime.getHours();
                                        if (isHoliday) {
                                            if (hour < 12 && morningPeriods.length > 0) periodGroups = [{ label: '오전', periods: morningPeriods.map(x => x.p) }];
                                            else if (hour < 18) periodGroups = [{ label: '오후', periods: dayPeriods.map(x => x.p) }];
                                            else periodGroups = [{ label: '야간', periods: nightPeriods.map(x => x.p) }];
                                        } else {
                                            if (hour < 18) periodGroups = [{ label: '주간', periods: dayPeriods.map(x => x.p) }];
                                            else periodGroups = [{ label: '야간', periods: nightPeriods.map(x => x.p) }];
                                        }

                                        // Fallback if groups are empty
                                        if (periodGroups.length === 0 || periodGroups[0].periods.length === 0) {
                                            if (dayPeriods.length > 0) periodGroups = [{ label: isHoliday ? '오후' : '주간', periods: dayPeriods.map(x => x.p) }];
                                        }
                                    }

                                    // --- Monitor Logic (Seat Level) ---
                                    if (assignment && mode === 'monitor' && activeLeaves.length > 0) {
                                        // Check for 'Away' (Seat Level Status)
                                        const awayReq = activeLeaves.find(req =>
                                            (req.student_id === assignment.student_id || req.leave_request_students?.some((s: any) => s.student_id === assignment.student_id)) &&
                                            req.leave_type === '자리비움' &&
                                            new Date(req.start_time) <= currentTime
                                        );

                                        if (awayReq) {
                                            activeLeaveReq = awayReq;
                                            const start = new Date(awayReq.start_time);
                                            const diffMins = (currentTime.getTime() - start.getTime()) / 60000;

                                            // Away status: Strong Red
                                            seatStatusColor = "bg-red-500 border-red-600";
                                            // >10m: Blinking (intensive flash) as a nudge
                                            if (diffMins >= 10) isAwayBlinking = true;
                                        }
                                    } else if (mode === 'edit' && assignment) {
                                        seatStatusColor = "bg-yellow-50 border-yellow-200";
                                    }

                                    // --- Period Status Helper ---
                                    const getPeriodStatus = (label: string, periodName: string) => {
                                        // 1. Check if 'Past' based on database timetable
                                        const typeFilter = isHoliday ? 'weekend' : 'weekday';
                                        // Label check: if '야간' look for night, otherwise day
                                        const isNight = label === '야간';
                                        const entry = timetable.find(t =>
                                            t.day_type.includes(typeFilter) &&
                                            (isNight ? t.day_type.includes('night') : t.day_type.includes('day')) &&
                                            t.description.includes(periodName)
                                        );

                                        if (!entry) return { status: 'future', type: null };

                                        const entryEndTime = entry.end_time.substring(0, 5); // HH:mm
                                        const isPast = currentHHmm > entryEndTime;



                                        // 2. Check Assignments for this period
                                        if (assignment && activeLeaves.length > 0) {
                                            const studentLeaves = activeLeaves.filter(req => {
                                                const isTargetStudent = (req.student_id === assignment.student_id || req.leave_request_students?.some((s: any) => s.student_id === assignment.student_id));
                                                if (!isTargetStudent) return false;

                                                const leaveDate = new Date(req.start_time);
                                                const now = new Date();
                                                const isSameDay =
                                                    leaveDate.getFullYear() === now.getFullYear() &&
                                                    leaveDate.getMonth() === now.getMonth() &&
                                                    leaveDate.getDate() === now.getDate();

                                                return isSameDay;
                                            });

                                            // Active Away check
                                            const activeAway = studentLeaves.find(leave => leave.leave_type === '자리비움');
                                            if (activeAway) {
                                                const entryStartTime = entry.start_time.substring(0, 5);
                                                const isCurrentPeriod = currentHHmm >= entryStartTime && currentHHmm <= entryEndTime;
                                                if (isCurrentPeriod) {
                                                    return { status: 'active', type: '자리비움' };
                                                }
                                            }

                                            for (const leave of studentLeaves) {
                                                // Robust matching: Check if it contains the Label (e.g. '야간') AND the specific period (e.g. '1교시')
                                                // This handles "야간1교시", "야간 1교시", etc. safely.
                                                if (leave.period && leave.period.includes(label) && leave.period.includes(`${periodName}교시`)) {
                                                    return { status: isPast ? 'past' : 'active', type: leave.leave_type };
                                                }
                                            }
                                        }

                                        if (isPast) return { status: 'past', type: null };
                                        return { status: 'future', type: null };
                                    };

                                    // Determine Header Color based on first active period
                                    let headerBgClass = "bg-white";
                                    let studentIdTextColor = "text-gray-800";

                                    if (assignment && periodGroups[0]) {
                                        const firstActiveP = periodGroups[0].periods.find(p => getPeriodStatus(periodGroups[0].label, p).status === 'active');
                                        if (firstActiveP) {
                                            const { type } = getPeriodStatus(periodGroups[0].label, firstActiveP);
                                            switch (type) {
                                                case '컴이석': headerBgClass = "bg-blue-200"; studentIdTextColor = "text-blue-800"; break;
                                                case '이석': headerBgClass = "bg-orange-200"; studentIdTextColor = "text-orange-800"; break;
                                                case '외출': headerBgClass = "bg-yellow-200"; studentIdTextColor = "text-yellow-800"; break;
                                                case '외박': headerBgClass = "bg-purple-200"; studentIdTextColor = "text-purple-800"; break;
                                            }
                                        }
                                    }

                                    if (isDisabled && mode === 'monitor') {
                                        return (
                                            <div key={seatNum} className="relative w-full h-[54px] bg-gray-300 border-r border-b border-gray-200">
                                                {/* Disabled Seat (Dead Space) */}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={seatNum} className="relative group">
                                            {/* Rectangular Seat Card */}
                                            <div
                                                onClick={() => {
                                                    if (mode === 'edit') {
                                                        setSelectedSeat(seatNum);
                                                        setIsModalOpen(true);
                                                    } else if (mode === 'monitor' && activeLeaveReq && activeLeaveReq.leave_type === '자리비움') {
                                                        if (confirm('자리비움을 해제하시겠습니까?')) {
                                                            supabase.from('leave_requests')
                                                                .update({ status: '취소' })
                                                                .eq('id', activeLeaveReq.id)
                                                                .then(() => {
                                                                    fetchLiveStatus(selectedRoom);
                                                                });
                                                        }
                                                    }
                                                }}
                                                className={clsx(
                                                    "relative flex flex-col border-r border-b border-gray-200 overflow-hidden transition-all",
                                                    isDisabled ? "bg-gray-300" : "bg-white",
                                                    !assignment && !isDisabled && "bg-gray-50/50",
                                                    "w-full h-[54px]",
                                                    mode === 'edit' && !isDisabled && "cursor-pointer hover:bg-yellow-50/50 hover:border-yellow-400 group/card z-10",
                                                    mode === 'edit' && isDisabled && "cursor-pointer z-10", // Allow selection but no hover effect
                                                    activeLeaveReq?.leave_type === '자리비움' && !isAwayBlinking && "bg-red-50",
                                                    isAwayBlinking && "animate-[pulse_1s_infinite] bg-red-100 ring-2 ring-red-500 ring-inset"
                                                )}
                                            >
                                                {/* Seat Number on Top-Right Inside */}
                                                {!isDisabled && (
                                                    <span className={clsx(
                                                        "absolute top-0.5 right-1 text-[8px] font-medium select-none z-20",
                                                        activeLeaveReq?.leave_type === '자리비움' ? "text-white/80" : "text-gray-300"
                                                    )}>
                                                        {displaySeatNum}
                                                    </span>
                                                )}

                                                {isDisabled ? (
                                                    <div className="flex-1">
                                                        {/* Empty for Dead Space */}
                                                    </div>
                                                ) : assignment ? (
                                                    <>
                                                        {/* Top Section: Student ID Only */}
                                                        {/* Top Section: Student ID Only */}
                                                        <div className={clsx(
                                                            "flex-1 flex items-center px-1.5 border-b border-gray-100 transition-colors",
                                                            activeLeaveReq?.leave_type === '자리비움' ? (isAwayBlinking ? "bg-red-600" : "bg-red-500") : headerBgClass
                                                        )}>
                                                            <span className={clsx("text-[11px] truncate font-medium", activeLeaveReq?.leave_type === '자리비움' ? "text-white" : studentIdTextColor)}>
                                                                {assignment.student?.student_id}
                                                                {activeLeaveReq?.leave_type === '자리비움' && (
                                                                    <span className={clsx("ml-auto text-[7px] text-white font-bold", isAwayBlinking ? "animate-bounce" : "animate-pulse")}>자리비움</span>
                                                                )}
                                                            </span>
                                                        </div>

                                                        {/* Bottom Section: Period Blocks */}
                                                        <div className="h-5 flex divide-x divide-gray-100 bg-gray-50/30">
                                                            {mode === 'monitor' && periodGroups[0]?.periods.map(p => {
                                                                const { status, type } = getPeriodStatus(periodGroups[0].label, p);

                                                                let blockClass = "";
                                                                let textClass = "text-transparent";
                                                                let content = p;

                                                                if (status === 'active' && type) {
                                                                    textClass = "font-bold";
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
                                                                            blockClass = "bg-yellow-200";
                                                                            textClass = "text-yellow-800";
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
                                                                    if (type) {
                                                                        textClass = "font-medium text-gray-600 relative z-10";
                                                                        switch (type) {
                                                                            case '컴이석': content = '컴'; break;
                                                                            case '이석': content = '이'; break;
                                                                            case '외출': content = '출'; break;
                                                                            case '외박': content = '박'; break;
                                                                            case '자리비움': content = '비'; break;
                                                                        }
                                                                        // Fallback: If switch didn't match and content is still 'p', use first char of type
                                                                        if (content === p && type.length > 0) content = type[0];
                                                                    }
                                                                }

                                                                return (
                                                                    <div key={p} className={clsx("flex-1 flex items-center justify-center text-[7px] md:text-[9px] transition-colors", blockClass, textClass)}>
                                                                        {content}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="flex-1 flex items-center justify-center">
                                                        <span className="text-gray-300 text-[12px] group-hover:text-yellow-500 transition-colors">
                                                            {mode === 'edit' ? "+" : ""}
                                                        </span>
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

            {/* Assignment Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm transform transition-all scale-100">
                        {(() => {
                            if (selectedSeat === null) return null;
                            const disabledCountBefore = seatProperties.filter(p => p.seat_number < selectedSeat && p.is_disabled).length;
                            const displaySeatNum = selectedSeat - disabledCountBefore;
                            const isCurrentDisabled = seatProperties.find(p => p.seat_number === selectedSeat)?.is_disabled;

                            return (
                                <>
                                    <h2 className="text-lg font-extrabold text-gray-800 mb-4">
                                        {selectedRoom}열람실 {isCurrentDisabled ? '(비활성)' : `${displaySeatNum}번 좌석`} 관리
                                        <span className="text-xs text-gray-400 font-normal ml-2">
                                            (Slot #{selectedSeat})
                                        </span>
                                    </h2>
                                </>
                            );
                        })()}

                        <div className="mb-6">
                            <label className="block text-xs font-bold text-gray-400 mb-2">학생 선택</label>
                            <Select
                                autoFocus
                                options={students
                                    .filter(s => !assignments.some(a => a.student_id === s.student_id)) // Filter out already assigned students
                                    .map(s => ({
                                        value: s.student_id,
                                        label: `${s.student_id} ${s.name}`,
                                        student: s
                                    }))}
                                onChange={(option: any) => {
                                    assignStudent(option.value);
                                }}
                                placeholder="이름 또는 학번 검색..."
                                styles={{
                                    control: (base) => ({
                                        ...base,
                                        borderRadius: '1rem',
                                        padding: '4px',
                                        borderColor: '#e5e7eb',
                                        boxShadow: 'none',
                                        '&:hover': { borderColor: '#fbbf24' }
                                    }),
                                    option: (base, state) => ({
                                        ...base,
                                        backgroundColor: state.isFocused ? '#fefce8' : 'white',
                                        color: '#1f2937',
                                        fontWeight: '500',
                                        cursor: 'pointer'
                                    })
                                }}
                            />
                        </div>

                        <div className="flex gap-2">
                            {/* Disable Toggle (Priority) */}
                            <button
                                onClick={() => toggleSeatDisabled(selectedSeat)}
                                className={clsx(
                                    "flex-1 py-3 font-bold rounded-xl transition-colors",
                                    seatProperties.find(p => p.seat_number === selectedSeat)?.is_disabled
                                        ? "bg-green-100 text-green-600 hover:bg-green-200"
                                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                )}
                            >
                                {seatProperties.find(p => p.seat_number === selectedSeat)?.is_disabled ? "⭕ 좌석 활성화" : "🚫 좌석 비활성화"}
                            </button>
                        </div>
                        <div className="h-px bg-gray-100 my-4" />

                        <div className="flex gap-2">
                            {/* If assigned, show remove button */}
                            {assignments.find(a => a.seat_number === selectedSeat) && (
                                <button
                                    onClick={() => assignStudent(null)}
                                    className="flex-1 py-3 bg-red-50 text-red-500 font-bold rounded-xl hover:bg-red-100 transition-colors"
                                >
                                    배정 해제
                                </button>
                            )}
                            <button
                                onClick={() => { setIsModalOpen(false); setSelectedSeat(null); }}
                                className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors"
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
