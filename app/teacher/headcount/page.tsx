'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { StudentSelectModal } from '@/components/room/StudentSelectModal';
import { Student } from '@/components/student/types';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

// Room Layout Configuration (Row, Col) based on floor plan
// Abstracted using last 2 digits (01-25)
// Room Layout Configuration (Row, Col) based on floor plan
// Abstracted using last 2 digits (01-25)
const DEFAULT_LAYOUT: Record<number, { row: number, col: number }> = {
    // Top Row (06-10)
    6: { row: 1, col: 1 },
    7: { row: 1, col: 2 },
    8: { row: 1, col: 3 },
    9: { row: 1, col: 4 },
    10: { row: 1, col: 5 },

    // Left Column (05-01) -> Col 3
    5: { row: 2, col: 3 },
    4: { row: 3, col: 3 },
    3: { row: 4, col: 3 },
    2: { row: 5, col: 3 },
    1: { row: 6, col: 3 },

    // Right Column (11-15) -> Col 5
    11: { row: 2, col: 5 },
    12: { row: 3, col: 5 },
    13: { row: 4, col: 5 },
    14: { row: 5, col: 5 },
    15: { row: 6, col: 5 },

    // Bottom Area (Inner: 21-25, Outer: 16-20)
    21: { row: 7, col: 4 }, 16: { row: 7, col: 5 },
    22: { row: 8, col: 4 }, 17: { row: 8, col: 5 },
    23: { row: 9, col: 4 }, 18: { row: 9, col: 5 },
    24: { row: 10, col: 4 }, 19: { row: 10, col: 5 },
    25: { row: 11, col: 4 }, 20: { row: 11, col: 5 },
};

const FLOOR_1_LAYOUT: Record<number, { row: number, col: number }> = {
    // 1-19: Same as Default
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].reduce((acc, idx) => ({ ...acc, [idx]: DEFAULT_LAYOUT[idx] }), {}),

    // 20-23: Inner Column (Left of 119 column) -> Col 4
    // 20 (New 120) takes spot of Old 121 (Row 7 Col 4)
    20: { row: 7, col: 4 },
    21: { row: 8, col: 4 },
    22: { row: 9, col: 4 },
    23: { row: 10, col: 4 }
    // 24, 25 Deleted
};

const FLOOR_2_LAYOUT: Record<number, { row: number, col: number }> = {
    // 1-20: Same as Default
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].reduce((acc, idx) => ({ ...acc, [idx]: DEFAULT_LAYOUT[idx] }), {}),

    // 21: Below 20 (Row 11 Col 5) -> Row 12 Col 5 (Outer)
    21: { row: 12, col: 5 },

    // 22 (Old 21 pos) ~ 27: Inner Column (Col 4)
    22: { row: 7, col: 4 },
    23: { row: 8, col: 4 },
    24: { row: 9, col: 4 },
    25: { row: 10, col: 4 },
    26: { row: 11, col: 4 },
    27: { row: 12, col: 4 }
};

const FLOOR_4_LAYOUT: Record<number, { row: number, col: number }> = {
    // 1-19: Same as Default
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].reduce((acc, idx) => ({ ...acc, [idx]: DEFAULT_LAYOUT[idx] }), {}),
    // Old 20 (Row 11 Col 5) Deleted.

    // 20-25: Inner Column (Col 4)
    // 21 becomes 20 (Row 7 Col 4)
    20: { row: 7, col: 4 },
    21: { row: 8, col: 4 },
    22: { row: 9, col: 4 },
    23: { row: 10, col: 4 },
    24: { row: 11, col: 4 },
    25: { row: 12, col: 4 }
};

const FLOORS = [1, 2, 3, 4];
const getAllRooms = () => {
    const rooms: number[] = [];
    FLOORS.forEach(floor => {
        let layout = DEFAULT_LAYOUT;
        if (floor === 1) layout = FLOOR_1_LAYOUT;
        if (floor === 2) layout = FLOOR_2_LAYOUT;
        if (floor === 4) layout = FLOOR_4_LAYOUT;

        Object.keys(layout).forEach(idx => {
            rooms.push(floor * 100 + Number(idx));
        });
    });
    return rooms;
};

const ALL_ROOMS = getAllRooms();

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

export default function HeadcountPage() {
    const [currentTime, setCurrentTime] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [currentFloor, setCurrentFloor] = useState(3);

    // Mode: 'check' (Toggle In/Out) | 'assign' (Change Student)
    const [mode, setMode] = useState<'check' | 'assign'>('check');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{ room: number, position: 'left' | 'right' } | null>(null);

    // History Modal State
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyStudent, setHistoryStudent] = useState<{ name: string, student_id: string } | null>(null);
    const [historyRecords, setHistoryRecords] = useState<any[]>([]);

    const fetchStudentHistory = async (studentId: string, name: string) => {
        try {
            const { data } = await supabase
                .from('leave_requests')
                .select('*')
                .eq('student_id', studentId)
                .order('created_at', { ascending: false })
                .limit(20);

            if (data) {
                setHistoryRecords(data);
                setHistoryStudent({ student_id: studentId, name });
                setIsHistoryModalOpen(true);
            }
        } catch (e) {
            console.error(e);
            toast.error('기록을 불러오지 못했습니다.');
        }
    };

    // roomStatus includes name, status and student_id
    const [roomStatus, setRoomStatus] = useState<Record<number, {
        left: { status: 'in' | 'out', name: string, student_id?: string, isWeekend?: boolean, leaveType?: '외출' | '외박' },
        right: { status: 'in' | 'out', name: string, student_id?: string, isWeekend?: boolean, leaveType?: '외출' | '외박' }
    }>>({});
    const router = useRouter();

    useEffect(() => {
        // Clock
        const timer = setInterval(() => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
        }, 1000);
        setCurrentTime(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));

        // Fetch Data
        const fetchData = async () => {
            try {
                // Fetch Students
                const { data: students, error } = await supabase
                    .from('students')
                    .select('*');

                if (error) throw error;

                // Initialize Status based on Rooms and Students
                const initialStatus: any = {};

                // Group students by room
                const studentsByRoom: Record<number, Student[]> = {};
                students?.forEach((s: any) => {
                    const room = s.room_number || s.room; // Try both likely names
                    if (room) {
                        if (!studentsByRoom[room]) studentsByRoom[room] = [];
                        studentsByRoom[room].push(s);
                    }
                });

                // Fetch Leave Requests for overnight status
                const now = new Date();
                const nowStr = now.toISOString();

                const { data: leaveData } = await supabase
                    .from('leave_requests')
                    .select('student_id, status, leave_type, start_time, end_time, leave_request_students(student_id)')
                    .eq('status', '승인')
                    .eq('leave_type', '외박')
                    .lte('start_time', nowStr)
                    .gte('end_time', nowStr);

                // Leave Type Map: student_id -> '외출' | '외박'
                const outStatus = new Map<string, '외출' | '외박'>();

                leaveData?.forEach(req => {
                    // Normalize type (just in case)
                    const type = req.leave_type as '외출' | '외박';
                    // Add main applicant
                    if (req.student_id) outStatus.set(req.student_id, type);
                    // Add co-applicants
                    req.leave_request_students?.forEach((s: any) => {
                        outStatus.set(s.student_id, type);
                    });
                });

                ALL_ROOMS.forEach((roomNum) => {
                    const roomStudents = studentsByRoom[roomNum] || [];
                    initialStatus[roomNum] = {
                        left: {
                            status: roomStudents[0] && outStatus.has(roomStudents[0].student_id) ? 'out' : 'in',
                            leaveType: roomStudents[0] ? outStatus.get(roomStudents[0].student_id) : undefined,
                            name: roomStudents[0]?.name || '',
                            student_id: roomStudents[0]?.student_id || '',
                            isWeekend: roomStudents[0]?.weekend || false
                        },
                        right: {
                            status: roomStudents[1] && outStatus.has(roomStudents[1].student_id) ? 'out' : 'in',
                            leaveType: roomStudents[1] ? outStatus.get(roomStudents[1].student_id) : undefined,
                            name: roomStudents[1]?.name || '',
                            student_id: roomStudents[1]?.student_id || '',
                            isWeekend: roomStudents[1]?.weekend || false
                        }
                    };
                });

                // Load overrides from LocalStorage (Room Config)
                const savedConfig = localStorage.getItem('dormichan_assignments');
                if (savedConfig) {
                    const parsed = JSON.parse(savedConfig);
                    ALL_ROOMS.forEach(roomNum => {
                        const savedRoom = parsed[roomNum];
                        if (savedRoom) {
                            if (!initialStatus[roomNum]) initialStatus[roomNum] = { left: { status: 'in', name: '' }, right: { status: 'in', name: '' } };

                            if (savedRoom.left) {
                                initialStatus[roomNum].left.name = savedRoom.left.name;
                                initialStatus[roomNum].left.student_id = savedRoom.left.student_id;
                                initialStatus[roomNum].left.status = savedRoom.left.student_id && outStatus.has(savedRoom.left.student_id) ? 'out' : 'in';
                                initialStatus[roomNum].left.leaveType = savedRoom.left.student_id ? outStatus.get(savedRoom.left.student_id) : undefined;
                                // Restore weekend status from DB data
                                const student = students?.find((s: any) => s.student_id === savedRoom.left.student_id);
                                initialStatus[roomNum].left.isWeekend = student?.weekend || false;
                            } else {
                                initialStatus[roomNum].left.name = '';
                                initialStatus[roomNum].left.student_id = '';
                                initialStatus[roomNum].left.status = 'in';
                                initialStatus[roomNum].left.isWeekend = false;
                            }

                            if (savedRoom.right) {
                                initialStatus[roomNum].right.name = savedRoom.right.name;
                                initialStatus[roomNum].right.student_id = savedRoom.right.student_id;
                                initialStatus[roomNum].right.status = savedRoom.right.student_id && outStatus.has(savedRoom.right.student_id) ? 'out' : 'in';
                                initialStatus[roomNum].right.leaveType = savedRoom.right.student_id ? outStatus.get(savedRoom.right.student_id) : undefined;
                                // Restore weekend status from DB data
                                const student = students?.find((s: any) => s.student_id === savedRoom.right.student_id);
                                initialStatus[roomNum].right.isWeekend = student?.weekend || false;
                            } else {
                                initialStatus[roomNum].right.name = '';
                                initialStatus[roomNum].right.student_id = '';
                                initialStatus[roomNum].right.status = 'in';
                                initialStatus[roomNum].right.isWeekend = false;
                            }
                        }
                    });
                }

                setRoomStatus(initialStatus);
            } catch (err) {
                console.error('Error fetching students:', err);
                toast.error('학생 데이터를 불러오는데 실패했습니다.');

                // Fallback to mock names if fetch fails? Or just empty.
                const fallbackStatus: any = {};
                ALL_ROOMS.forEach((roomNum) => {
                    fallbackStatus[roomNum] = {
                        left: { status: 'in', name: '' },
                        right: { status: 'in', name: '' }
                    };
                });
                setRoomStatus(fallbackStatus);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();

        return () => clearInterval(timer);
    }, []);

    const toggleStatus = (roomNum: number, position: 'left' | 'right') => {
        setRoomStatus(prev => ({
            ...prev,
            [roomNum]: {
                ...prev[roomNum],
                [position]: {
                    ...prev[roomNum][position],
                    status: prev[roomNum][position].status === 'in' ? 'out' : 'in'
                }
            }
        }));
    };

    const handleBedClick = (roomNum: number, position: 'left' | 'right') => {
        if (mode === 'assign') {
            setSelectedSlot({ room: roomNum, position });
            setIsModalOpen(true);
        } else if (mode === 'check') {
            // In check mode, a single click toggles status
            toggleStatus(roomNum, position);
        }
    };

    const handleSelectStudent = (student: Student) => {
        if (!selectedSlot) return;
        const { room, position } = selectedSlot;

        setRoomStatus(prev => ({
            ...prev,
            [room]: {
                ...prev[room],
                [position]: {
                    ...prev[room][position],
                    name: student.name,
                    student_id: student.student_id,
                    status: 'in', // Reset status on new assignment
                    isWeekend: student.weekend || false
                }
            }
        }));
        setIsModalOpen(false);
    };

    const handleSave = async () => {
        const loading = toast.loading('배정 현황 저장 중...');
        const storageData: Record<number, any> = {};
        Object.keys(roomStatus).forEach(key => {
            const k = Number(key);
            storageData[k] = {
                left: { name: roomStatus[k].left.name, student_id: roomStatus[k].left.student_id },
                right: { name: roomStatus[k].right.name, student_id: roomStatus[k].right.student_id }
            };
        });

        localStorage.setItem('dormichan_assignments', JSON.stringify(storageData));
        await new Promise(r => setTimeout(r, 600));
        toast.success('저장되었습니다.', { id: loading });
    };

    const handleResetAssignments = () => {
        // if (!confirm('현재 배정된 모든 학생 정보를 초기화하시겠습니까?')) return;

        const resetData: any = {};
        ALL_ROOMS.forEach(r => {
            resetData[r] = {
                left: { status: 'in', name: '', student_id: '' },
                right: { status: 'in', name: '', student_id: '' }
            };
        });
        setRoomStatus(resetData);
        localStorage.setItem('dormichan_assignments', JSON.stringify({}));
        toast.success('초기화되었습니다. (저장 버튼을 눌러 확정하세요)');
    };

    return (
        <div className="h-screen flex flex-col bg-black text-white font-sans selection:bg-orange-500 selection:text-white overflow-hidden">
            <Toaster toastOptions={{
                className: 'bg-gray-800 text-white border border-white/10',
                style: { background: '#1f2937', color: '#fff' }
            }} />

            {/* Header - Fixed */}
            <header className="flex-none p-4 pb-2 z-50 bg-black/80 backdrop-blur-md border-b border-white/10 flex justify-between items-start shadow-xl">
                <div className="flex flex-col gap-1">
                    <button
                        onClick={() => router.push('/teacher')}
                        className="self-start p-2 rounded text-sm hover:bg-gray-800/80 text-yellow-400 font-bold border border-yellow-400/30 flex items-center justify-center gap-2 mb-2 transition-all whitespace-nowrap"
                    >
                        <span>⬅</span>
                        <span>교사 페이지</span>
                    </button>
                    <div className="flex items-center gap-3">
                        <span className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">
                            DormiCheck
                        </span>
                        <span className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded border border-gray-700 font-mono">
                            {currentTime}
                        </span>
                    </div>

                    {/* Floor Selector Tabs */}
                    <div className="flex gap-1 mt-1">
                        {[1, 2, 3, 4].map(floor => (
                            <button
                                key={floor}
                                onClick={() => setCurrentFloor(floor)}
                                className={clsx(
                                    "px-3 py-1 rounded text-xs font-bold transition-all border",
                                    currentFloor === floor
                                        ? "bg-orange-600 border-orange-500 text-white"
                                        : "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700"
                                )}
                            >
                                {floor}F
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                    {/* Mode Toggle */}
                    <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
                        <button
                            onClick={() => setMode('check')}
                            className={clsx(
                                "px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap",
                                mode === 'check' ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:text-white"
                            )}
                        >
                            📋 점검
                        </button>
                        <button
                            onClick={() => setMode('assign')}
                            className={clsx(
                                "px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap",
                                mode === 'assign' ? "bg-purple-600 text-white shadow-md" : "text-gray-400 hover:text-white"
                            )}
                        >
                            ⚙️ 배정
                        </button>
                    </div>

                    {/* Action Buttons (Stacked below toggle on mobile/desktop to save width) */}
                    {mode === 'assign' && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-5">
                            <button
                                onClick={handleResetAssignments}
                                className="px-3 py-1.5 text-red-400 font-bold text-xs bg-gray-800 rounded-lg border border-red-900/30 hover:bg-red-900/20 transition-all whitespace-nowrap"
                            >
                                초기화
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-1.5 bg-green-600 text-white font-bold text-xs rounded-lg hover:bg-green-500 shadow-lg shadow-green-900/20 transition-all whitespace-nowrap"
                            >
                                저장
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* Main Content - Zoomable Area */}
            <div className="flex-1 relative overflow-hidden bg-[#121212] w-full h-full">
                <TransformWrapper
                    initialScale={0.4}
                    minScale={0.4}
                    maxScale={1}
                    centerOnInit={true}
                    wheel={{ step: 0.1 }}
                    panning={{ disabled: false }}
                    doubleClick={{ disabled: true }}
                    limitToBounds={false}
                >
                    <TransformComponent
                        wrapperStyle={{ width: "100%", height: "100%" }}
                        contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                        <div className="grid grid-cols-5 gap-1.5 min-w-[1200px] select-none">
                            {Object.keys(currentFloor === 1 ? FLOOR_1_LAYOUT : (currentFloor === 2 ? FLOOR_2_LAYOUT : (currentFloor === 4 ? FLOOR_4_LAYOUT : DEFAULT_LAYOUT))).map((key) => {
                                const idx = Number(key);
                                const roomNum = currentFloor * 100 + idx;
                                const roomData = roomStatus[roomNum] || { left: { status: 'in', name: '', student_id: '' }, right: { status: 'in', name: '', student_id: '' } };
                                const layout = currentFloor === 1 ? FLOOR_1_LAYOUT : (currentFloor === 2 ? FLOOR_2_LAYOUT : (currentFloor === 4 ? FLOOR_4_LAYOUT : DEFAULT_LAYOUT));
                                const pos = layout[idx];

                                // Layout helpers based on relative index
                                // Top Row: 6-10 (Side by Side)
                                const isSideBySide = idx >= 6 && idx <= 10;
                                // Left Col (1-5) & Bottom Left (21-25) are Reverse Vertical
                                // NOTE: Floor 1 assumes simple vertical for 21+, Floor 2 different.
                                // Floor 4: Inner is 20-25. Vertical.
                                const isReverseVertical = (idx >= 1 && idx <= 5) || (currentFloor !== 1 && currentFloor !== 2 && currentFloor !== 4 && idx >= 21 && idx <= 25);

                                return (
                                    <div
                                        key={roomNum}
                                        style={{
                                            gridColumn: pos?.col,
                                            gridRow: pos?.row
                                        }}
                                        className={clsx(
                                            "relative overflow-hidden rounded-[1rem] bg-[#1c1c1e] border border-white/5 p-1 flex flex-col gap-0.5 shadow-lg transition-all",
                                            isSideBySide ? "h-24 w-full" : "h-40 w-3/5 min-w-[80px] mx-auto"
                                        )}
                                    >
                                        {/* Room Number Header */}
                                        <div className="flex justify-center items-center px-1 py-0.5 shrink-0">
                                            <span className={clsx(
                                                "font-bold tracking-tight text-white/90",
                                                isSideBySide ? "text-[10px]" : "text-[11px]"
                                            )}>
                                                {roomNum}
                                            </span>
                                        </div>

                                        <div className={clsx(
                                            "flex flex-1 gap-1 h-full",
                                            isSideBySide ? "flex-row" : (isReverseVertical ? "flex-col-reverse" : "flex-col")
                                        )}>
                                            {/* Left Bed */}
                                            <button
                                                onDoubleClick={(e) => {
                                                    if (roomData.left.student_id) {
                                                        e.stopPropagation();
                                                        fetchStudentHistory(roomData.left.student_id, roomData.left.name);
                                                    }
                                                }}
                                                onClick={() => handleBedClick(roomNum, 'left')}
                                                disabled={false}
                                                className={clsx(
                                                    "relative flex-1 rounded-md border flex flex-col items-center justify-center transition-all duration-200",
                                                    "group active:scale-95",
                                                    mode === 'check'
                                                        ? (roomData.left.status === 'out'
                                                            ? (roomData.left.leaveType === '외출'
                                                                ? "bg-green-600 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]" // Outing (Green)
                                                                : "bg-purple-600 border-purple-500 shadow-[0_0_10px_rgba(147,51,234,0.4)]") // Stay-out (Purple)
                                                            : (
                                                                // Present (In) & Has Student & NOT Weekly Home Goer -> Bright Light Effect
                                                                roomData.left.name && !(isWeeklyHomeTime(new Date()) && roomData.left.isWeekend)
                                                                    ? "bg-white border-white shadow-[0_0_12px_rgba(255,255,255,0.6)] z-10"
                                                                    : "bg-[#1f2937] border-gray-700 hover:border-gray-500 hover:bg-gray-700"
                                                            ))
                                                        : "bg-[#1f2937] border-dashed border-gray-600 hover:border-purple-400 hover:bg-gray-700"
                                                )}
                                            >
                                                {/* Bed Position Label (Small) */}
                                                <span className={clsx(
                                                    "absolute top-0.5 left-1 text-[7px] font-black group-hover:text-gray-400",
                                                    mode === 'check' && roomData.left.status === 'in' && roomData.left.name ? "text-gray-400" : "text-gray-600"
                                                )}>
                                                    L
                                                </span>

                                                {/* Overlap background for Weekly Home Goer -> REMOVED to match empty dark color as requested */}
                                                {/* {mode === 'check' && isWeeklyHomeTime(new Date()) && roomData.left.isWeekend && (
                                                    <div className="absolute inset-0 bg-gray-200/90 z-20 flex items-center justify-center rounded-md" />
                                                )} */}

                                                {/* Student Name */}
                                                <span className={clsx(
                                                    "text-[12px] font-bold truncate max-w-full leading-tight px-1 flex flex-col items-center z-30",
                                                    mode === 'check' && isWeeklyHomeTime(new Date()) && roomData.left.isWeekend
                                                        ? "text-gray-400" // Weekly Home text color (Light gray for dark bg)
                                                        : (
                                                            mode === 'check' && roomData.left.status === 'in' && roomData.left.name
                                                                ? "text-black" // Present text color (on white)
                                                                : (
                                                                    mode === 'check' && roomData.left.status === 'out'
                                                                        ? "text-white"
                                                                        : "text-gray-300"
                                                                )
                                                        ),
                                                    mode === 'assign' && !roomData.left.name && "text-gray-600 text-[10px]"
                                                )}>
                                                    {roomData.left.name ? (roomData.left.student_id || roomData.left.name) : (mode === 'assign' ? '빈 침대' : '-')}
                                                    {mode === 'check' && isWeeklyHomeTime(new Date()) && roomData.left.isWeekend && (
                                                        <span className="text-[12px] font-bold text-gray-600 mt-1">매주귀가</span>
                                                    )}
                                                </span>
                                            </button>

                                            {/* Right Bed */}
                                            <button
                                                onDoubleClick={(e) => {
                                                    if (roomData.right.student_id) {
                                                        e.stopPropagation();
                                                        fetchStudentHistory(roomData.right.student_id, roomData.right.name);
                                                    }
                                                }}
                                                onClick={() => handleBedClick(roomNum, 'right')}
                                                disabled={false}
                                                className={clsx(
                                                    "relative flex-1 rounded-md border flex flex-col items-center justify-center transition-all duration-200",
                                                    "group active:scale-95",
                                                    mode === 'check'
                                                        ? (roomData.right.status === 'out'
                                                            ? (roomData.right.leaveType === '외출'
                                                                ? "bg-green-600 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]" // Outing (Green)
                                                                : "bg-purple-600 border-purple-500 shadow-[0_0_10px_rgba(147,51,234,0.4)]") // Stay-out (Purple)
                                                            : (
                                                                // Present (In) & Has Student & NOT Weekly Home Goer -> Bright Light Effect
                                                                roomData.right.name && !(isWeeklyHomeTime(new Date()) && roomData.right.isWeekend)
                                                                    ? "bg-white border-white shadow-[0_0_12px_rgba(255,255,255,0.6)] z-10"
                                                                    : "bg-[#1f2937] border-gray-700 hover:border-gray-500 hover:bg-gray-700"
                                                            ))
                                                        : "bg-[#1f2937] border-dashed border-gray-600 hover:border-purple-400 hover:bg-gray-700"
                                                )}
                                            >
                                                {/* Bed Position Label */}
                                                <span className={clsx(
                                                    "absolute top-0.5 left-1 text-[7px] font-black group-hover:text-gray-400",
                                                    mode === 'check' && roomData.right.status === 'in' && roomData.right.name ? "text-gray-400" : "text-gray-600"
                                                )}>
                                                    R
                                                </span>

                                                {/* Overlap background for Weekly Home Goer -> REMOVED to match empty dark color as requested */}
                                                {/* {mode === 'check' && isWeeklyHomeTime(new Date()) && roomData.right.isWeekend && (
                                                    <div className="absolute inset-0 bg-gray-200/90 z-20 flex items-center justify-center rounded-md" />
                                                )} */}

                                                {/* Student Name */}
                                                <span className={clsx(
                                                    "text-[12px] font-bold truncate max-w-full leading-tight px-1 flex flex-col items-center z-30",
                                                    mode === 'check' && isWeeklyHomeTime(new Date()) && roomData.right.isWeekend
                                                        ? "text-gray-400" // Weekly Home text color
                                                        : (
                                                            mode === 'check' && roomData.right.status === 'in' && roomData.right.name
                                                                ? "text-black" // Present text color
                                                                : (
                                                                    mode === 'check' && roomData.right.status === 'out'
                                                                        ? "text-white"
                                                                        : "text-gray-300"
                                                                )
                                                        ),
                                                    mode === 'assign' && !roomData.right.name && "text-gray-600 text-[10px]"
                                                )}>
                                                    {roomData.right.name ? (roomData.right.student_id || roomData.right.name) : (mode === 'assign' ? '빈 침대' : '-')}
                                                    {mode === 'check' && isWeeklyHomeTime(new Date()) && roomData.right.isWeekend && (
                                                        <span className="text-[12px] font-bold text-gray-600 mt-1">매주귀가</span>
                                                    )}
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </TransformComponent>
                </TransformWrapper>
            </div>

            <StudentSelectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSelect={handleSelectStudent}
                assignedStudentIds={
                    // Filter out ALL currently assigned ids to prevent duplicates
                    Object.values(roomStatus).flatMap(r => [r.left.student_id, r.right.student_id]).filter(Boolean) as string[]
                }
            />

            {/* Student History Modal */}
            {isHistoryModalOpen && historyStudent && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsHistoryModalOpen(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden text-gray-800" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                                    {historyStudent.name[0]}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-bold text-gray-800">{historyStudent.student_id}</h3>
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (!confirm(`${historyStudent.student_id} 학생을 호출하시겠습니까?\n(앱 알림이 전송됩니다)`)) return;
                                                try {
                                                    const res = await fetch('/api/teacher/summon', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            studentId: historyStudent.student_id,
                                                            teacherName: '담당 교사'
                                                        })
                                                    });
                                                    if (res.ok) toast.success('호출 알림을 보냈습니다.');
                                                    else toast.error('호출 실패');
                                                } catch (err) {
                                                    toast.error('오류 발생');
                                                }
                                            }}
                                            className="px-2 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-lg hover:bg-red-200 transition-colors flex items-center gap-1"
                                        >
                                            <span>🔔 호출</span>
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500">최근 이석 기록 (최신순 20건)</p>
                                </div>
                            </div>
                            <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400">
                                ✕
                            </button>
                        </div>

                        <div className="overflow-y-auto p-4 flex flex-col gap-3">
                            {historyRecords.length === 0 ? (
                                <div className="py-10 text-center text-gray-400 text-sm">기록이 없습니다.</div>
                            ) : (
                                historyRecords.map((rec) => {
                                    const statusColors: any = {
                                        '신청': 'bg-blue-50 text-blue-600',
                                        '승인': 'bg-green-50 text-green-600',
                                        '반려': 'bg-red-50 text-red-600',
                                        '취소': 'bg-gray-50 text-gray-500',
                                        '복귀': 'bg-gray-100 text-gray-600',
                                        '학부모승인': 'bg-orange-50 text-orange-600',
                                        '학부모승인대기': 'bg-yellow-50 text-yellow-600',
                                    };

                                    return (
                                        <div key={rec.id} className="flex flex-col p-3 rounded-2xl border border-gray-100 hover:border-blue-200 transition-colors bg-white shadow-sm">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold border border-opacity-10", statusColors[rec.status] || 'bg-gray-50 text-gray-500')}>
                                                        {rec.status}
                                                    </span>
                                                    <span className="font-bold text-gray-700 text-sm">{rec.leave_type}</span>
                                                </div>
                                                <span className="text-[10px] text-gray-400">{new Date(rec.created_at).toLocaleDateString()}</span>
                                            </div>

                                            <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded-lg mb-2">
                                                {rec.leave_type === '컴이석' || rec.leave_type === '이석' ? (
                                                    <div className="font-mono text-xs">
                                                        {rec.period}
                                                    </div>
                                                ) : (
                                                    <div>
                                                        {new Date(rec.start_time).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} ~
                                                        {new Date(rec.end_time).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                )}
                                            </div>

                                            {rec.reason && (
                                                <p className="text-[11px] text-gray-500 truncate">
                                                    Running: {rec.reason}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
