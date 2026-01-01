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

interface RoomLayout {
    room_number: number;
    columns: number;
    total_seats: number;
}

export default function SeatManagementPage() {
    const [selectedRoom, setSelectedRoom] = useState(1);
    const [mode, setMode] = useState<'monitor' | 'edit'>('monitor'); // 'monitor' | 'edit'
    const [isLoading, setIsLoading] = useState(true);
    const [students, setStudents] = useState<Student[]>([]);
    const [assignments, setAssignments] = useState<SeatAssignment[]>([]);
    const [layout, setLayout] = useState<RoomLayout>({ room_number: 1, columns: 6, total_seats: 30 });
    const [activeLeaves, setActiveLeaves] = useState<any[]>([]);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Edit Mode for Layout
    const [isEditingLayout, setIsEditingLayout] = useState(false);
    const [tempLayout, setTempLayout] = useState<RoomLayout>({ ...layout });

    // Student Selection Modal
    const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        fetchCommonData();
        // Clock for Monitor Mode
        const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetchRoomData(selectedRoom);
        if (mode === 'monitor') {
            fetchLiveStatus(selectedRoom);
            // Auto-refresh every 30 seconds for live status
            const refreshTimer = setInterval(() => fetchLiveStatus(selectedRoom), 30000);
            return () => clearInterval(refreshTimer);
        }
    }, [selectedRoom, mode]);

    const fetchCommonData = async () => {
        const { data } = await supabase.from('students').select('*').order('student_id');
        if (data) setStudents(data);
    };

    const fetchLiveStatus = async (roomNum: number) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data } = await supabase
            .from('leave_requests')
            .select('*, leave_request_students(student_id)')
            .eq('status', '승인') // user requested approved only
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

    return (
        <div className="p-4 md:p-6 bg-gray-100 min-h-screen">
            <Toaster />

            <div className="flex flex-col w-full max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-yellow-400 rounded-full"></div>
                        <h1 className="text-xl font-extrabold text-gray-800">학습감독 자리배치 관리</h1>
                    </div>
                    <button
                        onClick={() => window.location.href = '/teacher'}
                        className="text-gray-500 hover:text-gray-800 font-bold"
                    >
                        ← 뒤로가기
                    </button>
                </div>

                {/* Room Tabs & Mode Toggle */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                    <div className="flex gap-2">
                        {[1, 2, 3].map(room => (
                            <button
                                key={room}
                                onClick={() => setSelectedRoom(room)}
                                className={clsx(
                                    "px-6 py-3 rounded-2xl font-bold text-lg transition-all shadow-sm",
                                    selectedRoom === room
                                        ? "bg-yellow-400 text-white shadow-md scale-105"
                                        : "bg-white text-gray-400 hover:bg-gray-50"
                                )}
                            >
                                제 {room} 열람실
                            </button>
                        ))}
                    </div>

                    <div className="bg-white p-1 rounded-xl flex border border-gray-100 shadow-sm">
                        <button
                            onClick={() => setMode('monitor')}
                            className={clsx(
                                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                                mode === 'monitor' ? "bg-gray-800 text-white shadow-md" : "text-gray-400 hover:bg-gray-50"
                            )}
                        >
                            📺 현황 모니터
                        </button>
                        <button
                            onClick={() => setMode('edit')}
                            className={clsx(
                                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                                mode === 'edit' ? "bg-gray-800 text-white shadow-md" : "text-gray-400 hover:bg-gray-50"
                            )}
                        >
                            ✏️ 좌석 관리
                        </button>
                    </div>
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
                <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border border-gray-100 min-h-[500px]">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div
                            className="grid gap-1.5 md:gap-2 mx-auto w-fit"
                            style={{
                                gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`
                            }}
                        >
                            {Array.from({ length: layout.total_seats }).map((_, idx) => {
                                const seatNum = idx + 1;
                                const assignment = assignments.find(a => a.seat_number === seatNum);

                                // --- Monitor Mode Variables ---
                                let seatStatusColor = "bg-[#e0e5ec]"; // Neumorphic base
                                let isAwayBlinking = false;
                                let activeLeaveReq: any = null; // For seat-level click actions (Away)

                                // Period Config (Dynamic Visibility)
                                const hour = currentTime.getHours();
                                const day = currentTime.getDay();
                                const isWeekend = day === 0 || day === 6;

                                let periodGroups: { label: string, periods: string[] }[] = [];

                                if (isWeekend) {
                                    if (hour < 12) {
                                        // Morning (Until 12:00)
                                        periodGroups = [{ label: '오전', periods: ['1', '2', '3'] }];
                                    } else if (hour >= 12 && hour < 18) {
                                        // Afternoon (12:00 - 18:00)
                                        periodGroups = [{ label: '오후', periods: ['4', '5', '6'] }];
                                    } else {
                                        // Night (After 18:00)
                                        periodGroups = [{ label: '야간', periods: ['1', '2', '3'] }];
                                    }
                                } else {
                                    if (hour < 18) {
                                        // Weekday Day
                                        periodGroups = [{ label: '주간', periods: ['8', '9'] }];
                                    } else {
                                        // Weekday Night
                                        periodGroups = [{ label: '야간', periods: ['1', '2', '3', '4'] }];
                                    }
                                }

                                // --- Monitor Logic (Seat Level) ---
                                if (assignment && mode === 'monitor' && activeLeaves.length > 0) {
                                    // Check for 'Away' (Seat Level Status)
                                    const awayReq = activeLeaves.find(req =>
                                        (req.student_id === assignment.student_id || req.leave_request_students?.some((s: any) => s.student_id === assignment.student_id)) &&
                                        req.leave_type === '자리비움' &&
                                        new Date(req.start_time) <= currentTime && new Date(req.end_time) >= currentTime
                                    );

                                    if (awayReq) {
                                        activeLeaveReq = awayReq;
                                        seatStatusColor = "bg-red-50 border-red-200"; // Light red tint for seat
                                        const start = new Date(awayReq.start_time);
                                        const diffMins = (currentTime.getTime() - start.getTime()) / 60000;
                                        if (diffMins >= 10) isAwayBlinking = true;
                                    }
                                } else if (mode === 'edit' && assignment) {
                                    seatStatusColor = "bg-yellow-50 border-yellow-200";
                                }

                                // --- Period Status Helper ---
                                const getPeriodStatus = (label: string, periodName: string) => {
                                    // 1. Check if 'Past'
                                    let periodEndHour = 0;
                                    if (label === '주간' && periodName === '8') periodEndHour = 17;
                                    if (label === '주간' && periodName === '9') periodEndHour = 18;
                                    if (label === '야간' && periodName === '1') periodEndHour = 20;
                                    if (label === '야간' && periodName === '2') periodEndHour = 21;
                                    if (label === '야간' && periodName === '3') periodEndHour = 22;
                                    if (label === '야간' && periodName === '4') periodEndHour = 23;

                                    if (isWeekend) {
                                        if (label === '오전') periodEndHour = 9 + parseInt(periodName);
                                        if (label === '오후') periodEndHour = 12 + parseInt(periodName); // 4->16? Wait. 13+p. 4->17?
                                        // Let's approximate: 
                                        // Morn: 1(10), 2(11), 3(12)
                                        // Aft: 4(14), 5(15), 6(16)
                                        // Night: 1(20)...
                                        if (label === '야간') periodEndHour = 18 + parseInt(periodName);
                                    }

                                    const isPast = hour >= periodEndHour;

                                    // 2. Check Assignments for this period
                                    if (assignment && activeLeaves.length > 0) {
                                        // Find leave for this specific period
                                        // We need to check all approved leaves for this student targeting TODAY
                                        const studentLeaves = activeLeaves.filter(req => {
                                            const isTargetStudent = (req.student_id === assignment.student_id || req.leave_request_students?.some((s: any) => s.student_id === assignment.student_id));
                                            if (!isTargetStudent) return false;

                                            // Date Validation: Must be today (Local Date check)
                                            const leaveDate = new Date(req.start_time);
                                            const now = new Date(); // Use actual current clock
                                            const isSameDay =
                                                leaveDate.getFullYear() === now.getFullYear() &&
                                                leaveDate.getMonth() === now.getMonth() &&
                                                leaveDate.getDate() === now.getDate();

                                            return isSameDay;
                                        });

                                        for (const leave of studentLeaves) {
                                            // Check text match in 'period' field
                                            const fullLabel = `${label}${periodName}교시`;
                                            if (leave.period && leave.period.includes(fullLabel)) {
                                                return { status: 'active', type: leave.leave_type };
                                            }
                                        }
                                    }

                                    if (isPast) return { status: 'past', type: null };
                                    return { status: 'future', type: null };
                                };

                                // Font Size Calculation
                                const studentIdFontSize = "text-[10px]";

                                return (
                                    <div
                                        key={seatNum}
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
                                            "relative flex flex-col items-center justify-center transition-all overflow-hidden p-1.5",
                                            // V9.2 Scaled-up Pill Design
                                            assignment ? "bg-black rounded-[20px] shadow-lg border border-white/10 active:scale-95" : "bg-gray-100 border border-dashed border-gray-300 rounded-[20px]",
                                            "w-full h-13 md:h-14 min-w-0 px-2",
                                            mode === 'edit' ? "cursor-pointer hover:border-yellow-400 group" : "cursor-default",
                                            seatStatusColor !== "bg-black" && !assignment && seatStatusColor,
                                            isAwayBlinking && "animate-pulse ring-2 ring-red-500"
                                        )}
                                    >
                                        {/* Seat Number - Sub-layer in Edit Mode */}
                                        {mode === 'edit' && (
                                            <span className="absolute top-1 left-2 text-[7px] font-bold text-gray-400">
                                                {seatNum}
                                            </span>
                                        )}

                                        {assignment ? (
                                            <>
                                                {/* 1. Student ID - Top Center (10px) */}
                                                <div className="text-gray-300 text-[10px] font-extrabold tracking-tighter leading-none mb-1.5">
                                                    {assignment.student?.student_id}
                                                </div>

                                                {/* 2. Period Buttons: Larger circles */}
                                                <div className="flex items-center justify-center gap-1 w-full h-6 md:h-7 px-1">
                                                    {mode === 'monitor' && periodGroups.map((group) => (
                                                        <Fragment key={group.label}>
                                                            {group.periods.map(p => {
                                                                const { status, type } = getPeriodStatus(group.label, p);

                                                                let btnClass = "bg-zinc-800 text-zinc-600 border border-zinc-700/50";
                                                                let content = p;

                                                                if (status === 'past') {
                                                                    btnClass = "bg-zinc-700 text-zinc-500 border-zinc-600";
                                                                } else if (status === 'active' && type) {
                                                                    const baseStyle = "text-black font-black border-transparent shadow-[0_0_10px_rgba(255,255,255,0.2)]";
                                                                    switch (type) {
                                                                        case '컴이석': btnClass = `bg-blue-300 ${baseStyle}`; content = '컴'; break;
                                                                        case '이석': btnClass = `bg-orange-400 ${baseStyle}`; content = '이'; break;
                                                                        case '외출': btnClass = `bg-[#808000] ${baseStyle}`; content = '출'; break;
                                                                        case '외박': btnClass = `bg-purple-400 ${baseStyle}`; content = '박'; break;
                                                                        default: btnClass = `bg-orange-400 ${baseStyle}`; content = '이';
                                                                    }
                                                                }

                                                                return (
                                                                    <div key={p}
                                                                        className={clsx(
                                                                            "h-full aspect-square rounded-full flex items-center justify-center text-[9px] md:text-[10px] transition-all select-none",
                                                                            btnClass
                                                                        )}
                                                                        title={`${group.label} ${p}교시`}
                                                                    >
                                                                        {content}
                                                                    </div>
                                                                );
                                                            })}
                                                        </Fragment>
                                                    ))}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex items-center justify-center w-full h-full">
                                                <span className="text-gray-400 text-[10px] group-hover:text-yellow-500 transition-colors">
                                                    {mode === 'edit' ? "+" : ""}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Assignment Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm transform transition-all scale-100">
                        <h2 className="text-lg font-extrabold text-gray-800 mb-4">
                            {selectedRoom}열람실 {selectedSeat}번 좌석 배정
                        </h2>

                        <div className="mb-6">
                            <label className="block text-xs font-bold text-gray-400 mb-2">학생 선택</label>
                            <Select
                                autoFocus
                                options={students.map(s => ({
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
