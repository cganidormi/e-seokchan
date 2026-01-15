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
// Grid: 5 Columns
// Rows: Dynamic
const ROOM_GRID_POS: Record<number, { row: number, col: number }> = {
    // Top Row
    306: { row: 1, col: 1 },
    307: { row: 1, col: 2 },
    308: { row: 1, col: 3 },
    309: { row: 1, col: 4 },
    310: { row: 1, col: 5 },

    // Left Column -> Moved to Col 3 (Under 308)
    305: { row: 2, col: 3 },
    304: { row: 3, col: 3 },
    303: { row: 4, col: 3 },
    302: { row: 5, col: 3 },
    301: { row: 6, col: 3 },

    // Right Column
    311: { row: 2, col: 5 },
    312: { row: 3, col: 5 },
    313: { row: 4, col: 5 },
    314: { row: 5, col: 5 },
    315: { row: 6, col: 5 },

    // Bottom Left (Inner)
    // Bottom Left (Inner) -> Moved to Col 4 (More Right)
    321: { row: 7, col: 4 }, // Adjacent to 316 (Col 5)
    322: { row: 8, col: 4 },
    323: { row: 9, col: 4 },
    324: { row: 10, col: 4 },
    325: { row: 11, col: 4 },

    // Right Column Extension (316-320 under 315)
    316: { row: 7, col: 5 },
    317: { row: 8, col: 5 },
    318: { row: 9, col: 5 },
    319: { row: 10, col: 5 },
    320: { row: 11, col: 5 },
};



const ROOMS = Object.keys(ROOM_GRID_POS).map(Number);

export default function HeadcountPage() {
    const [currentTime, setCurrentTime] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // Mode: 'check' (Toggle In/Out) | 'assign' (Change Student)
    const [mode, setMode] = useState<'check' | 'assign'>('check');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{ room: number, position: 'left' | 'right' } | null>(null);

    // roomStatus includes name, status and student_id
    const [roomStatus, setRoomStatus] = useState<Record<number, {
        left: { status: 'in' | 'out', name: string, student_id?: string },
        right: { status: 'in' | 'out', name: string, student_id?: string }
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
                // Assuming 'students' table has 'room_number' or 'room'
                // If not, we might fail to map correctly. 
                // Let's try to select * to get whatever fields are there.
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

                const outStudentIds = new Set<string>();
                leaveData?.forEach(req => {
                    // Add main applicant
                    if (req.student_id) outStudentIds.add(req.student_id);
                    // Add co-applicants
                    req.leave_request_students?.forEach((s: any) => {
                        outStudentIds.add(s.student_id);
                    });
                });

                ROOMS.forEach((roomNum) => {
                    const roomStudents = studentsByRoom[roomNum] || [];
                    initialStatus[roomNum] = {
                        left: {
                            status: roomStudents[0] && outStudentIds.has(roomStudents[0].student_id) ? 'out' : 'in',
                            name: roomStudents[0]?.name || '',
                            student_id: roomStudents[0]?.student_id || ''
                        },
                        right: {
                            status: roomStudents[1] && outStudentIds.has(roomStudents[1].student_id) ? 'out' : 'in',
                            name: roomStudents[1]?.name || '',
                            student_id: roomStudents[1]?.student_id || ''
                        }
                    };
                });

                // Load overrides from LocalStorage (Room Config)
                const savedConfig = localStorage.getItem('dormichan_assignments');
                if (savedConfig) {
                    const parsed = JSON.parse(savedConfig);
                    ROOMS.forEach(roomNum => {
                        const savedRoom = parsed[roomNum];
                        if (savedRoom) {
                            if (!initialStatus[roomNum]) initialStatus[roomNum] = { left: { status: 'in', name: '' }, right: { status: 'in', name: '' } };

                            if (savedRoom.left) {
                                initialStatus[roomNum].left.name = savedRoom.left.name;
                                initialStatus[roomNum].left.student_id = savedRoom.left.student_id;
                                initialStatus[roomNum].left.status = savedRoom.left.student_id && outStudentIds.has(savedRoom.left.student_id) ? 'out' : 'in';
                            } else {
                                initialStatus[roomNum].left.name = '';
                                initialStatus[roomNum].left.student_id = '';
                                initialStatus[roomNum].left.status = 'in';
                            }

                            if (savedRoom.right) {
                                initialStatus[roomNum].right.name = savedRoom.right.name;
                                initialStatus[roomNum].right.student_id = savedRoom.right.student_id;
                                initialStatus[roomNum].right.status = savedRoom.right.student_id && outStudentIds.has(savedRoom.right.student_id) ? 'out' : 'in';
                            } else {
                                initialStatus[roomNum].right.name = '';
                                initialStatus[roomNum].right.student_id = '';
                                initialStatus[roomNum].right.status = 'in';
                            }
                        }
                    });
                } else {
                    // Only mock if no config
                    initialStatus[306] = {
                        left: { status: 'in', name: '김철수' },
                        right: { status: 'in', name: '이영희' }
                    };
                }

                // (Mock removed - handled in usage)

                setRoomStatus(initialStatus);
            } catch (err) {
                console.error('Error fetching students:', err);
                toast.error('학생 데이터를 불러오는데 실패했습니다.');

                // Fallback to mock names if fetch fails? Or just empty.
                // For safety, let's just initialize with empty names
                const fallbackStatus: any = {};
                ROOMS.forEach((roomNum) => {
                    fallbackStatus[roomNum] = {
                        left: { status: 'in', name: '' },
                        right: { status: 'in', name: '' }
                    };
                });

                // Temporary Mock for 306 (Fallback)
                fallbackStatus[306] = {
                    left: { status: 'in', name: '김철수' },
                    right: { status: 'in', name: '이영희' }
                };

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
        }
        // Manual toggle removed in 'check' mode
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
                    status: 'in' // Reset status on new assignment
                }
            }
        }));
        setIsModalOpen(false);
        // Note: Auto-save or Manual save? User liked "Save" button.
        // We will rely on "Save" button in header.
    };

    const handleSave = async () => {
        const loading = toast.loading('배정 현황 저장 중...');
        // Transform roomStatus to simpler storage format if needed, or store as is.
        // Storage format used in RoomManagement was { 306: { left: {name, student_id}, ... } }
        // We should match that structure to be clean.
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
        if (!confirm('현재 배정된 모든 학생 정보를 초기화하시겠습니까?')) return;

        const resetData: any = {};
        ROOMS.forEach(r => {
            resetData[r] = {
                left: { status: 'in', name: '', student_id: '' },
                right: { status: 'in', name: '', student_id: '' }
            };
        });
        setRoomStatus(resetData);
        localStorage.setItem('dormichan_assignments', JSON.stringify({})); // Clear storage too immediately? Or wait for save?
        // Let's clear storage to be safe, or just update state.
        // Better to update state and let user click Save?
        // But reset usually implies action.
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
                    <div className="flex items-center gap-3">
                        <span className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">
                            DormiCheck
                        </span>
                        <span className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded border border-gray-700 font-mono">
                            {currentTime}
                        </span>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-gray-200">3rd Floor</h1>
                </div>

                <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                        {/* Mode Toggle */}
                        <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
                            <button
                                onClick={() => setMode('check')}
                                className={clsx(
                                    "px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                                    mode === 'check' ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:text-white"
                                )}
                            >
                                📋 점검
                            </button>
                            <button
                                onClick={() => setMode('assign')}
                                className={clsx(
                                    "px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                                    mode === 'assign' ? "bg-purple-600 text-white shadow-md" : "text-gray-400 hover:text-white"
                                )}
                            >
                                ⚙️ 배정
                            </button>
                        </div>

                        {mode === 'assign' && (
                            <>
                                <button
                                    onClick={handleResetAssignments}
                                    className="px-3 py-1.5 text-red-400 font-bold text-xs bg-gray-800 rounded-lg border border-red-900/30 hover:bg-red-900/20 transition-all"
                                >
                                    초기화
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-4 py-1.5 bg-green-600 text-white font-bold text-xs rounded-lg hover:bg-green-500 shadow-lg shadow-green-900/20 transition-all"
                                >
                                    저장
                                </button>
                            </>
                        )}
                    </div>
                    {/* Legend (Compact) */}
                    <div className="flex items-center gap-3 bg-gray-900/50 px-3 py-1 rounded-full border border-white/5">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-[#1f2937] border border-gray-600"></div>
                            <span className="text-[10px] text-gray-400">재실/빈침대 (In)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-orange-500 border border-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.4)]"></div>
                            <span className="text-[10px] text-gray-400">외박 (Out)</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content - Zoomable Area */}
            <div className="flex-1 relative overflow-hidden bg-[#121212] w-full h-full">
                <TransformWrapper
                    initialScale={0.8}
                    minScale={0.2}
                    maxScale={4}
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
                            {ROOMS.map((roomNum) => {
                                const roomData = roomStatus[roomNum] || { left: { status: 'in', name: '', student_id: '' }, right: { status: 'in', name: '', student_id: '' } };
                                const pos = ROOM_GRID_POS[roomNum];
                                const isSideBySide = roomNum >= 306 && roomNum <= 310;
                                const isReverseVertical = (roomNum >= 301 && roomNum <= 305) || (roomNum >= 321 && roomNum <= 325);

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
                                                onClick={() => handleBedClick(roomNum, 'left')}
                                                disabled={false}
                                                className={clsx(
                                                    "relative flex-1 rounded-md border flex flex-col items-center justify-center transition-all duration-200",
                                                    "group active:scale-95",
                                                    // Mode specific styling
                                                    mode === 'check'
                                                        ? (roomData.left.status === 'out'
                                                            ? "bg-purple-600 border-purple-500 shadow-[0_0_10px_rgba(147,51,234,0.4)]"
                                                            : "bg-[#1f2937] border-gray-700 hover:border-gray-500 hover:bg-gray-700")
                                                        : "bg-[#1f2937] border-dashed border-gray-600 hover:border-purple-400 hover:bg-gray-700"
                                                )}
                                            >
                                                {/* Bed Position Label (Small) */}
                                                <span className="absolute top-0.5 left-1 text-[7px] font-black text-gray-600 group-hover:text-gray-400">
                                                    L
                                                </span>

                                                {/* Student Name */}
                                                <span className={clsx(
                                                    "text-[12px] font-bold truncate max-w-full leading-tight px-1",
                                                    mode === 'check' && roomData.left.status === 'out' ? "text-white" : "text-gray-300",
                                                    mode === 'assign' && !roomData.left.name && "text-gray-600 text-[10px]"
                                                )}>
                                                    {roomData.left.name ? (roomData.left.student_id || roomData.left.name) : (mode === 'assign' ? '빈 침대' : '-')}
                                                </span>
                                            </button>

                                            {/* Right Bed */}
                                            <button
                                                onClick={() => handleBedClick(roomNum, 'right')}
                                                disabled={false}
                                                className={clsx(
                                                    "relative flex-1 rounded-md border flex flex-col items-center justify-center transition-all duration-200",
                                                    "group active:scale-95",
                                                    mode === 'check'
                                                        ? (roomData.right.status === 'out'
                                                            ? "bg-purple-600 border-purple-500 shadow-[0_0_10px_rgba(147,51,234,0.4)]"
                                                            : "bg-[#1f2937] border-gray-700 hover:border-gray-500 hover:bg-gray-700")
                                                        : "bg-[#1f2937] border-dashed border-gray-600 hover:border-purple-400 hover:bg-gray-700"
                                                )}
                                            >
                                                {/* Bed Position Label */}
                                                <span className="absolute top-0.5 left-1 text-[7px] font-black text-gray-600 group-hover:text-gray-400">
                                                    R
                                                </span>

                                                {/* Student Name */}
                                                <span className={clsx(
                                                    "text-[12px] font-bold truncate max-w-full leading-tight px-1",
                                                    mode === 'check' && roomData.right.status === 'out' ? "text-white" : "text-gray-300",
                                                    mode === 'assign' && !roomData.right.name && "text-gray-600 text-[10px]"
                                                )}>
                                                    {roomData.right.name ? (roomData.right.student_id || roomData.right.name) : (mode === 'assign' ? '빈 침대' : '-')}
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
        </div>
    );
}
