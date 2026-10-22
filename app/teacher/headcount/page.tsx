'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/supabaseClient';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import Select from 'react-select';
import { Student } from '@/components/student/types';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { MorningCheckoutModal } from '@/components/room/MorningCheckoutModal';
import { ViolationStatsModal } from '@/components/admin/ViolationStatsModal';
import { HiHome, HiChevronDoubleDown } from 'react-icons/hi';
import SwipeWrapper from '@/components/teacher/SwipeWrapper';
import SwipeNudgeDots from '@/components/teacher/SwipeNudgeDots';
import { isWeeklyHomeTime } from '@/lib/weeklyReturn';
import { LeaveProcessCard } from '@/components/teacher/LeaveProcessCard';
import { LeaveRequest } from '@/components/teacher/types';
import DashboardMain from '@/components/admin/DashboardMain';

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


export default function HeadcountPage() {
    const transformRef = useRef<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentFloor, setCurrentFloor] = useState(3);
    const [searchQuery, setSearchQuery] = useState('');

    // Mode: 'check' (Toggle In/Out) | 'assign' (Change Student)
    const [mode, setMode] = useState<'check' | 'assign'>('check');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{ room: number, position: 'left' | 'right' } | null>(null);

    // History Modal State
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isTodayModalOpen, setIsTodayModalOpen] = useState(false);
    const [isViolationModalOpen, setIsViolationModalOpen] = useState(false);
    const [historyStudent, setHistoryStudent] = useState<{ name: string, student_id: string } | null>(null);
    const [historyRecords, setHistoryRecords] = useState<any[]>([]);
    const [teacherPosition, setTeacherPosition] = useState<string>('');

    // Disciplinary Modal State
    const [isDisciplineModalOpen, setIsDisciplineModalOpen] = useState(false);
    const [disciplineRoomStudentIds, setDisciplineRoomStudentIds] = useState<string[]>([]);
    const [disciplineRoomNum, setDisciplineRoomNum] = useState<number | undefined>(undefined);

    // Headcount Badges Speech Bubble Popover State
    const [activePopoverGrade, setActivePopoverGrade] = useState<1 | 2 | 3 | 'all' | null>(null);
    const [activeLeavesMap, setActiveLeavesMap] = useState<Map<string, any>>(new Map());
    const [expandedCardId, setExpandedCardId] = useState<string | number | null>(null);
    const [menuCardId, setMenuCardId] = useState<string | number | null>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const badgesContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const rawLoginId = localStorage.getItem('dormichan_login_id') || sessionStorage.getItem('dormichan_login_id') || '';
        const loginId = rawLoginId.trim();

        const isSpecialTeacher = (str?: string | null) => {
            if (!str) return false;
            const clean = str.trim();
            return clean === '이소라' || clean === '고보배';
        };

        if (loginId) {
            // 로컬 스토리지 ID가 이소라 또는 고보배 선생님인 경우 즉시 1층으로 설정
            if (isSpecialTeacher(loginId)) {
                setCurrentFloor(1);
            }

            // teachers 테이블에서 교사 정보 조회
            supabase
                .from('teachers')
                .select('name, teacher_id, position')
                .or(`teacher_id.eq.${loginId},name.ilike.%${loginId}%`)
                .then(({ data }) => {
                    if (data && data.length > 0) {
                        const matched = data.find((t: any) =>
                            (t.teacher_id && t.teacher_id.trim() === loginId) ||
                            (t.name && t.name.trim() === loginId)
                        ) || data[0];

                        if (matched) {
                            if (matched.position) setTeacherPosition(matched.position);
                            if (isSpecialTeacher(matched.name) || isSpecialTeacher(matched.teacher_id)) {
                                setCurrentFloor(1);
                            }
                        }
                    }
                });
        }
    }, []);

    // 모바일(갤럭시/안드로이드) 호실 배치도 드래그 시 당겨서 새로고침(Pull-to-refresh) 방지
    useEffect(() => {
        const originalBodyOverscroll = document.body.style.overscrollBehaviorY;
        const originalHtmlOverscroll = document.documentElement.style.overscrollBehaviorY;
        document.body.style.overscrollBehaviorY = 'none';
        document.documentElement.style.overscrollBehaviorY = 'none';
        return () => {
            document.body.style.overscrollBehaviorY = originalBodyOverscroll;
            document.documentElement.style.overscrollBehaviorY = originalHtmlOverscroll;
        };
    }, []);

    const fetchStudentHistory = async (studentId: string, name: string) => {
        try {
            const { data } = await supabase
                .from('leave_requests')
                .select('*')
                .eq('student_id', studentId)
                .order('created_at', { ascending: false })
                .limit(30);

            if (data) {
                const now = new Date();
                const isRecordPast = (rec: any) => {
                    if (rec.status === '복귀' || rec.status === '취소' || rec.status === '반려' || rec.status === '거절') return true;
                    if (rec.end_time && new Date(rec.end_time) < now) return true;
                    return false;
                };

                const sorted = [...data].sort((a, b) => {
                    const aPast = isRecordPast(a);
                    const bPast = isRecordPast(b);

                    if (!aPast && bPast) return -1;
                    if (aPast && !bPast) return 1;

                    const timeA = new Date(a.start_time || a.created_at).getTime();
                    const timeB = new Date(b.start_time || b.created_at).getTime();
                    return timeB - timeA;
                });

                setHistoryRecords(sorted);
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
    const [checkedSlots, setCheckedSlots] = useState<Set<string>>(new Set());
    const router = useRouter();

    const [students, setStudents] = useState<Student[]>([]);
    const [specialHolidays, setSpecialHolidays] = useState<string[]>([]);

    useEffect(() => {
        // Fetch Data
        const fetchData = async () => {
            try {
                // Fetch Students & Holidays & Teachers
                const [
                    { data: studentsData, error: studentsError },
                    { data: holidayData },
                    { data: teachersData }
                ] = await Promise.all([
                    supabase.from('students').select('*').order('name'),
                    supabase.from('special_holidays').select('date'),
                    supabase.from('teachers').select('id, name')
                ]);

                if (studentsError) throw studentsError;
                if (studentsData) setStudents(studentsData);
                if (holidayData) setSpecialHolidays(holidayData.map((h: any) => h.date));

                const teacherMap = new Map<string, string>();
                teachersData?.forEach((t: any) => {
                    if (t.id && t.name) teacherMap.set(t.id, t.name.trim());
                });

                // Initialize Status based on Rooms and Students
                const initialStatus: any = {};

                // Group students by room
                const studentsByRoom: Record<number, Student[]> = {};
                studentsData?.forEach((s: any) => {
                    const room = s.room_number || s.room; // Try both likely names
                    if (room) {
                        if (!studentsByRoom[room]) studentsByRoom[room] = [];
                        studentsByRoom[room].push(s);
                    }
                });

                // Fetch Leave Requests for overnight status
                const now = new Date();
                const nowStr = now.toISOString();

                const { data: leaveData, error: leaveError } = await supabase
                    .from('leave_requests')
                    .select('id, student_id, status, leave_type, start_time, end_time, reason, place, period, created_at, teacher_id, leave_request_students(student_id)')
                    .eq('status', '승인')
                    .in('leave_type', ['외박', '외출'])
                    .lte('start_time', nowStr)
                    .gte('end_time', nowStr);

                if (leaveError) console.error('Error fetching leave requests:', leaveError);

                // Leave Type Map: student_id -> '외출' | '외박'
                const outStatus = new Map<string, '외출' | '외박'>();
                const leavesMap = new Map<string, any>();

                leaveData?.forEach(req => {
                    const type = req.leave_type as '외출' | '외박';
                    const enrichedReq = {
                        ...req,
                        teachers: req.teacher_id ? { name: teacherMap.get(req.teacher_id) || req.teacher_id } : { name: '-' }
                    };

                    // Add main applicant
                    if (req.student_id) {
                        outStatus.set(req.student_id, type);
                        leavesMap.set(req.student_id, enrichedReq);
                    }
                    // Add co-applicants
                    req.leave_request_students?.forEach((s: any) => {
                        outStatus.set(s.student_id, type);
                        leavesMap.set(s.student_id, enrichedReq);
                    });
                });
                setActiveLeavesMap(leavesMap);

                ALL_ROOMS.forEach((roomNum) => {
                    const roomStudents = studentsByRoom[roomNum] || [];

                    // 1. Explicit position mapping
                    let leftStudent = roomStudents.find(s => s.bed_position === 'left');
                    let rightStudent = roomStudents.find(s => s.bed_position === 'right');

                    // 2. Fallback for existing students without bed_position set
                    const unpositionedStudents = roomStudents.filter(s => !s.bed_position);
                    if (unpositionedStudents.length > 0) {
                        if (!leftStudent) {
                            leftStudent = unpositionedStudents.shift();
                        }
                        if (!rightStudent && unpositionedStudents.length > 0) {
                            rightStudent = unpositionedStudents.shift();
                        }
                    }

                    initialStatus[roomNum] = {
                        left: {
                            status: leftStudent && outStatus.has(leftStudent.student_id) ? 'out' : 'in',
                            leaveType: leftStudent ? outStatus.get(leftStudent.student_id) : undefined,
                            name: leftStudent?.name || '',
                            student_id: leftStudent?.student_id || '',
                            isWeekend: leftStudent?.weekend || false
                        },
                        right: {
                            status: rightStudent && outStatus.has(rightStudent.student_id) ? 'out' : 'in',
                            leaveType: rightStudent ? outStatus.get(rightStudent.student_id) : undefined,
                            name: rightStudent?.name || '',
                            student_id: rightStudent?.student_id || '',
                            isWeekend: rightStudent?.weekend || false
                        }
                    };
                });


                // NO LocalStorage Override. DB is source of truth.
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

        const channel = supabase
            .channel('headcount_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => {
                fetchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const toggleStatus = (roomNum: number, position: 'left' | 'right') => {
        const slotId = `${roomNum}-${position}`;
        setCheckedSlots(prev => {
            const next = new Set(prev);
            if (next.has(slotId)) next.delete(slotId);
            else next.add(slotId);
            return next;
        });
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

    const handleRoomNumberClick = (roomNum: number) => {
        const roomData = roomStatus[roomNum];
        if (!roomData) return;

        const ids: string[] = [];
        if (roomData.left.student_id) ids.push(roomData.left.student_id);
        if (roomData.right.student_id) ids.push(roomData.right.student_id);

        if (ids.length === 0) {
            toast.error('해당 호실에 배정된 학생이 없습니다.');
            return;
        }

        setDisciplineRoomStudentIds(ids);
        setDisciplineRoomNum(roomNum);
        setIsDisciplineModalOpen(true);
    };

    const assignStudent = async (studentId: string | null) => {
        if (!selectedSlot) return;
        const { room, position } = selectedSlot;

        const currentStudentId = roomStatus[room][position].student_id;

        // Auto-save to database immediately
        const loading = toast.loading(`${studentId ? '학생 배정 저장 중...' : '배정 해제 중...'}`);
        try {
            // The API takes an array of { student_id, room_number, bed_position }
            // If studentId is null, it means we are unassigning the current student.
            const updates: { student_id: string, room_number: number | null, bed_position: 'left' | 'right' | null }[] = [];

            if (studentId) {
                updates.push({ student_id: studentId, room_number: room, bed_position: position });
            } else if (currentStudentId) {
                // Unassign current student
                updates.push({ student_id: currentStudentId, room_number: null, bed_position: null });
            }

            const res = await fetch('/api/teacher/save-room-assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || '저장 실패');
            }

            // Optimistic UI update
            setRoomStatus(prev => {
                const newStatus = { ...prev };
                if (studentId) {
                    const student = students.find(s => s.student_id === studentId);
                    newStatus[room] = {
                        ...newStatus[room],
                        [position]: {
                            ...newStatus[room][position],
                            name: student?.name || '',
                            student_id: student?.student_id || '',
                            status: 'in',
                            isWeekend: student?.weekend || false
                        }
                    };
                } else {
                    newStatus[room] = {
                        ...newStatus[room],
                        [position]: {
                            ...newStatus[room][position],
                            name: '',
                            student_id: '',
                            status: 'in',
                            isWeekend: false
                        }
                    };
                }
                return newStatus;
            });

            setIsModalOpen(false);
            toast.success(studentId ? '학생이 배정되었습니다.' : '배정이 해제되었습니다.', { id: loading });
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || '저장 중 오류가 발생했습니다.', { id: loading });
        }
    };



    const handleResetAssignments = async () => {
        if (!confirm('현재 배정된 모든 학생 정보를 초기화하시겠습니까?')) return;

        const loading = toast.loading('초기화 중...');
        try {
            const updates: { student_id: string, room_number: null, bed_position?: 'left' | 'right' | null }[] = [];

            Object.keys(roomStatus).forEach(key => {
                const roomNum = Number(key);
                const roomData = roomStatus[roomNum];
                if (roomData.left.student_id) {
                    updates.push({ student_id: roomData.left.student_id, room_number: null, bed_position: null });
                }
                if (roomData.right.student_id) {
                    updates.push({ student_id: roomData.right.student_id, room_number: null, bed_position: null });
                }
            });

            // Use API to clear assignments (we can just pass an empty updates list to save-room-assignments, 
            // but that API expects all students to be assigned to what's in the list, and sets others to null.
            // Let's just call the API with empty updates to clear everything).
            const res = await fetch('/api/teacher/save-room-assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || '초기화 실패');
            }

            const resetData: any = {};
            ALL_ROOMS.forEach(r => {
                resetData[r] = {
                    left: { status: 'in', name: '', student_id: '' },
                    right: { status: 'in', name: '', student_id: '' }
                };
            });
            setRoomStatus(resetData);
            localStorage.setItem('dormichan_assignments', JSON.stringify({}));

            toast.success('초기화되었습니다.', { id: loading });
        } catch (e: any) {
            console.error(e);
            toast.error('초기화 중 오류가 발생했습니다.', { id: loading });
        }
    };

    const gradeMap = useMemo(() => {
        const map = new Map<string, number>();
        students.forEach(s => {
            if (s.student_id) {
                let g = s.grade;
                if (!g && /^[1-3]/.test(s.student_id)) {
                    g = parseInt(s.student_id[0], 10);
                }
                if (g) map.set(s.student_id, g);
            }
        });
        return map;
    }, [students]);

    // Compute floor stats (각 층별 1학년, 2학년, 3학년 현재원 / 정원 명수)
    const floorStats = useMemo(() => {
        const layout = currentFloor === 1 ? FLOOR_1_LAYOUT : (currentFloor === 2 ? FLOOR_2_LAYOUT : (currentFloor === 4 ? FLOOR_4_LAYOUT : DEFAULT_LAYOUT));
        const counts = {
            1: { present: 0, total: 0 },
            2: { present: 0, total: 0 },
            3: { present: 0, total: 0 }
        };
        const now = new Date();
        const isWeekend = isWeeklyHomeTime(now, specialHolidays);

        Object.keys(layout).forEach(key => {
            const roomNum = currentFloor * 100 + Number(key);
            const roomData = roomStatus[roomNum];
            if (!roomData) return;

            (['left', 'right'] as const).forEach(pos => {
                const slot = roomData[pos];
                if (slot.name) {
                    let grade = slot.student_id ? gradeMap.get(slot.student_id) : undefined;
                    if (!grade && slot.student_id && /^[1-3]/.test(slot.student_id)) {
                        grade = parseInt(slot.student_id[0], 10);
                    }
                    if (!grade && /^[1-3]/.test(slot.name)) {
                        grade = parseInt(slot.name[0], 10);
                    }

                    if (grade && (grade === 1 || grade === 2 || grade === 3)) {
                        counts[grade as 1 | 2 | 3].total++;

                        // 매주귀가 시간대에 매주귀가 학생 제외 or 현재 외박/외출 학생 제외
                        const isOut = slot.status === 'out' || (isWeekend && slot.isWeekend);
                        if (!isOut) {
                            counts[grade as 1 | 2 | 3].present++;
                        }
                    }
                }
            });
        });

        return counts;
    }, [roomStatus, currentFloor, gradeMap]);

    // Floor absent student counts per grade for badges
    const absentStats = useMemo(() => {
        const a1 = Math.max(0, floorStats[1].total - floorStats[1].present);
        const a2 = Math.max(0, floorStats[2].total - floorStats[2].present);
        const a3 = Math.max(0, floorStats[3].total - floorStats[3].present);
        const totalPresent = floorStats[1].present + floorStats[2].present + floorStats[3].present;
        const totalCount = floorStats[1].total + floorStats[2].total + floorStats[3].total;
        const aAll = Math.max(0, totalCount - totalPresent);
        return { 1: a1, 2: a2, 3: a3, all: aAll, totalPresent, totalCount };
    }, [floorStats]);

    // Student room search computation (이름 및 학번 검색)
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.trim().toLowerCase();
        const results: { displayName: string, roomNum: number, floor: number, position: 'left' | 'right' }[] = [];

        Object.entries(roomStatus).forEach(([key, val]) => {
            const roomNum = Number(key);
            const floor = Math.floor(roomNum / 100);
            (['left', 'right'] as const).forEach(pos => {
                const slot = val[pos];
                const nm = (slot.name || '').trim();
                const sid = (slot.student_id || '').trim();

                if (nm || sid) {
                    let displayName = sid;
                    if (!sid) {
                        displayName = nm;
                    } else if (nm && !sid.includes(nm)) {
                        if (/^\d+$/.test(sid)) {
                            displayName = `${sid} ${nm}`;
                        } else {
                            displayName = sid;
                        }
                    }

                    if (displayName.toLowerCase().includes(q) || nm.toLowerCase().includes(q) || sid.toLowerCase().includes(q)) {
                        results.push({
                            displayName,
                            roomNum,
                            floor,
                            position: pos
                        });
                    }
                }
            });
        });
        return results;
    }, [searchQuery, roomStatus]);

    // Absent students list for currently selected popover grade and floor (메인의 실제 외박/외출 카드만 연동)
    const absentStudentsList = useMemo(() => {
        if (activePopoverGrade === null) return [];
        const layout = currentFloor === 1 ? FLOOR_1_LAYOUT : (currentFloor === 2 ? FLOOR_2_LAYOUT : (currentFloor === 4 ? FLOOR_4_LAYOUT : DEFAULT_LAYOUT));
        const list: {
            student_id: string;
            name: string;
            grade: number;
            roomNum: number;
            position: 'left' | 'right';
            type: '외박' | '외출';
            leaveRequest: any;
        }[] = [];

        Object.keys(layout).forEach(key => {
            const roomNum = currentFloor * 100 + Number(key);
            const roomData = roomStatus[roomNum];
            if (!roomData) return;

            (['left', 'right'] as const).forEach(pos => {
                const slot = roomData[pos];
                if (!slot.name) return;

                let grade = slot.student_id ? gradeMap.get(slot.student_id) : undefined;
                if (!grade && slot.student_id && /^[1-3]/.test(slot.student_id)) {
                    grade = parseInt(slot.student_id[0], 10);
                }
                if (!grade && /^[1-3]/.test(slot.name)) {
                    grade = parseInt(slot.name[0], 10);
                }

                if (!grade) return;
                if (activePopoverGrade !== 'all' && grade !== activePopoverGrade) return;

                // 오직 메인페이지에 실제로 존재하는 진짜 승인 외박/외출 카드만 연결 (가짜 synthetic 완전 제거)
                if (slot.leaveType === '외박' || slot.leaveType === '외출') {
                    const leaveReq = slot.student_id ? activeLeavesMap.get(slot.student_id) : undefined;
                    if (leaveReq) {
                        list.push({
                            student_id: slot.student_id || '',
                            name: slot.name,
                            grade,
                            roomNum,
                            position: pos,
                            type: slot.leaveType,
                            leaveRequest: leaveReq
                        });
                    }
                }
            });
        });

        return list.sort((a, b) => a.roomNum - b.roomNum || (a.position === 'left' ? -1 : 1));
    }, [activePopoverGrade, currentFloor, roomStatus, gradeMap, activeLeavesMap]);

    // Handle badge click (toggle popover)
    const handleBadgeClick = (grade: 1 | 2 | 3 | 'all') => {
        if (activePopoverGrade === grade) {
            setActivePopoverGrade(null);
        } else {
            setActivePopoverGrade(grade);
        }
    };

    // Close popover on outside click
    useEffect(() => {
        if (activePopoverGrade === null) return;
        const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
            const target = e.target as Node;
            if (popoverRef.current && popoverRef.current.contains(target)) return;
            if (badgesContainerRef.current && badgesContainerRef.current.contains(target)) return;
            setActivePopoverGrade(null);
        };
        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('touchstart', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('touchstart', handleOutsideClick);
        };
    }, [activePopoverGrade]);

    // LeaveProcessCard status update handler
    const handleUpdateStatus = async (requestId: string | number, newStatus: string) => {
        try {
            const { error } = await supabase.from('leave_requests').update({ status: newStatus }).eq('id', requestId);
            if (error) throw error;

            if (newStatus === '복귀' || newStatus === '취소') {
                const foundStudent = absentStudentsList.find(s => s.leaveRequest?.id === requestId);
                if (foundStudent) {
                    setRoomStatus(prev => {
                        const room = prev[foundStudent.roomNum];
                        if (!room) return prev;
                        return {
                            ...prev,
                            [foundStudent.roomNum]: {
                                ...room,
                                [foundStudent.position]: {
                                    ...room[foundStudent.position],
                                    status: 'in',
                                    leaveType: undefined
                                }
                            }
                        };
                    });
                }
            }
            toast.success(`상태가 ${newStatus}(으)로 변경되었습니다.`);
        } catch (e) {
            console.error(e);
            toast.error('상태 변경 실패');
        }
    };

    const handleCancelLeave = async (requestId: string | number) => {
        await handleUpdateStatus(requestId, '취소');
    };

    // 빈 공간 더블 터치 / 더블 클릭 시 해당 위치 확대/축소 토글 기능
    const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

    const toggleZoomAtPoint = (clientX: number, clientY: number) => {
        if (!transformRef.current) return;
        const instance = transformRef.current.instance;
        if (!instance || !instance.wrapperComponent) return;

        const currentScale = instance.transformState?.scale ?? 0.3;

        // 이미 확대된 상태(0.45 이상)라면 전체보기 기본 배율(0.3)로 복귀
        if (currentScale > 0.45) {
            transformRef.current.resetTransform(300, 'easeOut');
            return;
        }

        // 축소 상태라면 터치한 빈 공간 위치를 화면 중앙으로 하여 0.85배율로 확대
        const wrapperRect = instance.wrapperComponent.getBoundingClientRect();
        const { positionX, positionY } = instance.transformState;

        const touchX = clientX - wrapperRect.left;
        const touchY = clientY - wrapperRect.top;

        const contentX = (touchX - positionX) / currentScale;
        const contentY = (touchY - positionY) / currentScale;

        const targetScale = 0.85;
        const newPosX = (wrapperRect.width / 2) - (contentX * targetScale);
        const newPosY = (wrapperRect.height / 2) - (contentY * targetScale);

        transformRef.current.setTransform(newPosX, newPosY, targetScale, 300, 'easeOut');
    };

    const handleCanvasClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        // 학생 침대 버튼, 호실 번호 버튼, 입력창 등 인터랙티브 요소는 줌 토글 제외
        if (target.closest('button') || target.closest('input') || target.closest('.no-zoom-toggle')) return;

        const now = Date.now();
        const last = lastTapRef.current;
        const clientX = e.clientX;
        const clientY = e.clientY;

        // 350ms 이내에 같은 영역(40px 이내)을 두 번 터치/클릭한 경우 더블 탭 판정
        if (last && now - last.time < 350 && Math.hypot(clientX - last.x, clientY - last.y) < 40) {
            lastTapRef.current = null;
            toggleZoomAtPoint(clientX, clientY);
        } else {
            lastTapRef.current = { time: now, x: clientX, y: clientY };
        }
    };

    const handleCanvasDoubleClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input') || target.closest('.no-zoom-toggle')) return;
        toggleZoomAtPoint(e.clientX, e.clientY);
    };

    return (
        <SwipeWrapper prevPath="/teacher/seats" topBottomOnly={true} topThresholdHeight={250}>
            <div className="h-screen flex flex-col bg-black text-white selection:bg-orange-500 selection:text-white overflow-hidden overscroll-y-none">
                <Toaster toastOptions={{
                className: 'bg-gray-800 text-white border border-white/10',
                style: { background: '#1f2937', color: '#fff' }
            }} />

            {/* Header - Fixed & Fully Responsive */}
            <header className="flex-none p-3.5 sm:p-4 pb-3 sm:pb-3.5 z-50 bg-black/80 backdrop-blur-md border-b border-white/10 flex flex-col gap-2.5 sm:gap-3 shadow-xl">
                {/* Top Row: Navigation & Mode Toggle */}
                <div className="relative flex justify-between items-center w-full gap-1 sm:gap-2 min-h-[36px]">
                    {/* Left: Title */}
                    <div className="flex items-center gap-1.5 shrink-0 min-w-0 z-10">
                        <div className="w-[3px] h-5 bg-orange-500 rounded-full shrink-0"></div>
                        <h1 className="text-base sm:text-xl font-black text-white whitespace-nowrap">
                            호실배치도
                        </h1>
                    </div>

                    {/* Center: Navigation Cluster (Left: 오늘의 홍지관 | Center: 홈 | Right: 좌석배치도) */}
                    <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center gap-1 sm:gap-1.5 z-10 pointer-events-auto">
                        {/* Left: 오늘의 홍지관 이동 버튼 */}
                        <button
                            onClick={() => router.push('/today')}
                            className="h-9 sm:h-10 px-2 sm:px-2.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
                            title="오늘의 홍지관으로 이동"
                        >
                            <div className="p-[1.5px] rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 shrink-0 shadow-xs">
                                <div className="p-[1px] bg-white rounded-full">
                                    <img src="/dorm.jpg" alt="오늘의 홍지관" className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover" />
                                </div>
                            </div>
                            <span className="hidden sm:inline text-xs sm:text-sm font-extrabold whitespace-nowrap">오늘의 홍지관</span>
                        </button>

                        {/* Center: 홈 버튼 */}
                        <button
                            onClick={() => router.push('/teacher', { scroll: false })}
                            className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 shadow-sm transition-all flex items-center justify-center cursor-pointer shrink-0 active:scale-95"
                            title="교사 홈으로 이동"
                        >
                            <HiHome className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
                        </button>

                        {/* Right: 좌석배치도로 이동 버튼 */}
                        <button
                            onClick={() => router.push('/teacher/seats', { scroll: false })}
                            className="h-9 sm:h-10 px-2 sm:px-2.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
                            title="좌석배치도로 이동"
                        >
                            <div className="p-[1.5px] rounded-full bg-gradient-to-tr from-teal-400 via-cyan-500 to-emerald-500 shrink-0 shadow-xs">
                                <div className="p-[1px] bg-white rounded-full">
                                    <img src="/study_room.png" alt="좌석배치도" className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover" />
                                </div>
                            </div>
                            <span className="hidden sm:inline text-xs sm:text-sm font-extrabold whitespace-nowrap">좌석배치도</span>
                        </button>
                    </div>

                    {/* Right: Room Management Toggle & Sub-Action (Reset on Left) */}
                    {(teacherPosition === '사감' || teacherPosition === '기숙사부장' || teacherPosition === '관리자' || !teacherPosition) && (
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 z-10">
                            {/* Reset Button Positioned to the Left (왼쪽으로 위치) */}
                            {mode === 'assign' && (
                                <button
                                    onClick={handleResetAssignments}
                                    className="px-2.5 py-1 text-red-300 hover:text-red-200 font-bold text-xs bg-red-950/80 backdrop-blur-xl rounded-lg border border-red-500/40 hover:bg-red-900/80 shadow-sm transition-all whitespace-nowrap cursor-pointer active:scale-95 flex items-center gap-1"
                                    title="전체 호실 배정 초기화"
                                >
                                    <span>⚠️ 초기화</span>
                                </button>
                            )}

                            <div className="flex items-center bg-gray-900/90 p-1 rounded-xl border border-gray-700/80 shadow-inner shrink-0">
                                <button
                                    onClick={() => setMode(mode === 'assign' ? 'check' : 'assign')}
                                    className={clsx(
                                        "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-extrabold transition-all duration-200 cursor-pointer whitespace-nowrap flex items-center gap-1.5",
                                        mode === 'assign'
                                            ? "bg-white text-gray-950 shadow-md font-black"
                                            : "bg-gray-700 hover:bg-gray-600 text-white shadow-sm border border-gray-600/70"
                                    )}
                                >
                                    <span>{mode === 'assign' ? '저장 & BACK' : '⚙️ 호실 관리'}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Pagination Dots (스와이프 넛지) - 3번 화면용 */}
                <div className="flex items-center justify-center w-full">
                    <SwipeNudgeDots currentIndex={2} theme="dark" className="bg-white/10 py-1.5 px-4 rounded-full shadow-inner backdrop-blur-sm" />
                </div>

                {/* Middle Row: Floor Grade Badges (말풍선 팝업 연동) */}
                <div ref={badgesContainerRef} className="relative w-full">
                    <div className="flex items-center justify-between w-full gap-1 sm:gap-1.5 whitespace-nowrap">
                        {/* 1학년 */}
                        <button
                            type="button"
                            onClick={() => handleBadgeClick(1)}
                            className={clsx(
                                "group relative flex flex-col items-center justify-center rounded-xl px-1 sm:px-2 py-1.5 sm:py-2 border flex-1 min-w-0 whitespace-nowrap shadow-sm cursor-pointer transition-all active:scale-95",
                                activePopoverGrade === 1
                                    ? "bg-yellow-500/20 border-yellow-400 ring-2 ring-yellow-400/40"
                                    : "bg-gray-800/90 hover:bg-gray-700/90 border-yellow-500/30"
                            )}
                            title="1학년 외박자 확인"
                        >
                            <div className="relative flex items-center justify-center w-full">
                                <span className="text-[11px] sm:text-xs font-extrabold text-yellow-400 leading-tight">1학년</span>
                                {absentStats[1] > 0 && (
                                    <span className="absolute -top-1 right-0 text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/50 shadow-[0_0_8px_rgba(250,204,21,0.35)] leading-none">
                                        {absentStats[1]}
                                    </span>
                                )}
                            </div>
                            <div className="relative flex items-center justify-center w-full mt-0.5">
                                <div className="relative inline-flex items-center justify-center">
                                    <span className="text-xs sm:text-base font-black text-yellow-200 tabular-nums leading-tight">
                                        {floorStats[1].present}/{floorStats[1].total}명
                                    </span>
                                    <HiChevronDoubleDown className={clsx(
                                        "absolute left-full top-1/2 -translate-y-1/2 ml-0.5 sm:ml-1 w-4 h-4 sm:w-5 sm:h-5 text-yellow-400/80 transition-transform duration-200 shrink-0",
                                        activePopoverGrade === 1 ? "rotate-180 text-yellow-400" : "group-hover:text-yellow-400"
                                    )} />
                                </div>
                            </div>
                        </button>

                        {/* 2학년 */}
                        <button
                            type="button"
                            onClick={() => handleBadgeClick(2)}
                            className={clsx(
                                "group relative flex flex-col items-center justify-center rounded-xl px-1 sm:px-2 py-1.5 sm:py-2 border flex-1 min-w-0 whitespace-nowrap shadow-sm cursor-pointer transition-all active:scale-95",
                                activePopoverGrade === 2
                                    ? "bg-sky-500/20 border-sky-400 ring-2 ring-sky-400/40"
                                    : "bg-gray-800/90 hover:bg-gray-700/90 border-sky-500/30"
                            )}
                            title="2학년 외박자 확인"
                        >
                            <div className="relative flex items-center justify-center w-full">
                                <span className="text-[11px] sm:text-xs font-extrabold text-sky-400 leading-tight">2학년</span>
                                {absentStats[2] > 0 && (
                                    <span className="absolute -top-1 right-0 text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded-full bg-sky-400/20 text-sky-300 border border-sky-400/50 shadow-[0_0_8px_rgba(56,189,248,0.35)] leading-none">
                                        {absentStats[2]}
                                    </span>
                                )}
                            </div>
                            <div className="relative flex items-center justify-center w-full mt-0.5">
                                <div className="relative inline-flex items-center justify-center">
                                    <span className="text-xs sm:text-base font-black text-sky-200 tabular-nums leading-tight">
                                        {floorStats[2].present}/{floorStats[2].total}명
                                    </span>
                                    <HiChevronDoubleDown className={clsx(
                                        "absolute left-full top-1/2 -translate-y-1/2 ml-0.5 sm:ml-1 w-4 h-4 sm:w-5 sm:h-5 text-sky-400/80 transition-transform duration-200 shrink-0",
                                        activePopoverGrade === 2 ? "rotate-180 text-sky-400" : "group-hover:text-sky-400"
                                    )} />
                                </div>
                            </div>
                        </button>

                        {/* 3학년 */}
                        <button
                            type="button"
                            onClick={() => handleBadgeClick(3)}
                            className={clsx(
                                "group relative flex flex-col items-center justify-center rounded-xl px-1 sm:px-2 py-1.5 sm:py-2 border flex-1 min-w-0 whitespace-nowrap shadow-sm cursor-pointer transition-all active:scale-95",
                                activePopoverGrade === 3
                                    ? "bg-red-500/20 border-red-400 ring-2 ring-red-400/40"
                                    : "bg-gray-800/90 hover:bg-gray-700/90 border-red-500/30"
                            )}
                            title="3학년 외박자 확인"
                        >
                            <div className="relative flex items-center justify-center w-full">
                                <span className="text-[11px] sm:text-xs font-extrabold text-red-400 leading-tight">3학년</span>
                                {absentStats[3] > 0 && (
                                    <span className="absolute -top-1 right-0 text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded-full bg-red-400/20 text-red-300 border border-red-400/50 shadow-[0_0_8px_rgba(248,113,113,0.35)] leading-none">
                                        {absentStats[3]}
                                    </span>
                                )}
                            </div>
                            <div className="relative flex items-center justify-center w-full mt-0.5">
                                <div className="relative inline-flex items-center justify-center">
                                    <span className="text-xs sm:text-base font-black text-red-200 tabular-nums leading-tight">
                                        {floorStats[3].present}/{floorStats[3].total}명
                                    </span>
                                    <HiChevronDoubleDown className={clsx(
                                        "absolute left-full top-1/2 -translate-y-1/2 ml-0.5 sm:ml-1 w-4 h-4 sm:w-5 sm:h-5 text-red-400/80 transition-transform duration-200 shrink-0",
                                        activePopoverGrade === 3 ? "rotate-180 text-red-400" : "group-hover:text-red-400"
                                    )} />
                                </div>
                            </div>
                        </button>

                        {/* 층 합계 */}
                        <button
                            type="button"
                            onClick={() => handleBadgeClick('all')}
                            className={clsx(
                                "group relative flex flex-col items-center justify-center rounded-xl px-1 sm:px-2 py-1.5 sm:py-2 border flex-1 min-w-0 whitespace-nowrap shadow-sm cursor-pointer transition-all active:scale-95",
                                activePopoverGrade === 'all'
                                    ? "bg-white/20 border-white ring-2 ring-white/40"
                                    : "bg-gray-800/90 hover:bg-gray-700/90 border-gray-600"
                            )}
                            title={`${currentFloor}층 전체 외박자 확인`}
                        >
                            <div className="relative flex items-center justify-center w-full">
                                <span className="text-[11px] sm:text-xs font-extrabold text-gray-300 leading-tight">
                                    <span className="hidden xs:inline">{currentFloor}층 </span>합계
                                </span>
                                {absentStats.all > 0 && (
                                    <span className="absolute -top-1 right-0 text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded-full bg-white/20 text-white border border-white/50 shadow-[0_0_8px_rgba(255,255,255,0.35)] leading-none">
                                        {absentStats.all}
                                    </span>
                                )}
                            </div>
                            <div className="relative flex items-center justify-center w-full mt-0.5">
                                <div className="relative inline-flex items-center justify-center">
                                    <span className="text-xs sm:text-base font-black text-white tabular-nums leading-tight">
                                        {absentStats.totalPresent}/{absentStats.totalCount}명
                                    </span>
                                    <HiChevronDoubleDown className={clsx(
                                        "absolute left-full top-1/2 -translate-y-1/2 ml-0.5 sm:ml-1 w-4 h-4 sm:w-5 sm:h-5 text-gray-300 transition-transform duration-200 shrink-0",
                                        activePopoverGrade === 'all' ? "rotate-180 text-white" : "group-hover:text-white"
                                    )} />
                                </div>
                            </div>
                        </button>
                    </div>

                    {/* Speech Bubble Popover (말풍선 꼬리가 달린 순수 타원형 외박자 카드) */}
                    {activePopoverGrade !== null && (
                        <div
                            ref={popoverRef}
                            className="absolute top-[calc(100%+10px)] left-0 right-0 z-50 animate-in fade-in slide-in-from-top-1 duration-150 filter drop-shadow-[0_20px_35px_rgba(0,0,0,0.85)]"
                        >
                            {/* Speech Bubble Arrow Tail (해당 블럭을 가리키는 말풍선 꼬리 - 1px 블럭 라인과 일치) */}
                            <div
                                className="absolute -top-[8px] -translate-x-1/2 pointer-events-none z-30 transition-all duration-200"
                                style={{
                                    left: activePopoverGrade === 1 ? '12.5%' :
                                          activePopoverGrade === 2 ? '37.5%' :
                                          activePopoverGrade === 3 ? '62.5%' : '87.5%'
                                }}
                            >
                                <svg width="20" height="9" viewBox="0 0 20 9" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
                                    <polygon points="1,9 10,1 19,9" fill="#1a1a1a" />
                                    <path
                                        d="M1 9L10 1L19 9"
                                        fill="none"
                                        stroke={
                                            activePopoverGrade === 1 ? "#facc15" :
                                            activePopoverGrade === 2 ? "#38bdf8" :
                                            activePopoverGrade === 3 ? "#f87171" : "#ffffff"
                                        }
                                        strokeWidth="1"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </div>

                            {/* 타원형 카드 스크롤 목록 */}
                            <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                                {absentStudentsList.length === 0 ? (
                                    <div
                                        className={clsx(
                                            "bg-[#1a1a1a] border shadow-2xl rounded-[2rem] px-5 py-3 !h-[60px] flex items-center justify-center text-xs font-bold",
                                            activePopoverGrade === 1 ? "border-yellow-400 text-yellow-200" :
                                            activePopoverGrade === 2 ? "border-sky-400 text-sky-200" :
                                            activePopoverGrade === 3 ? "border-red-400 text-red-200" :
                                            "border-white text-gray-300"
                                        )}
                                    >
                                        외박자가 없습니다.
                                    </div>
                                ) : (
                                    absentStudentsList.map(student => {
                                        const cardReq: LeaveRequest = student.leaveRequest;

                                        const cardBorder = activePopoverGrade === 1
                                            ? "border-yellow-400"
                                            : activePopoverGrade === 2
                                            ? "border-sky-400"
                                            : activePopoverGrade === 3
                                            ? "border-red-400"
                                            : student.grade === 1
                                            ? "border-yellow-400"
                                            : student.grade === 2
                                            ? "border-sky-400"
                                            : student.grade === 3
                                            ? "border-red-400"
                                            : "border-white";

                                        return (
                                            <LeaveProcessCard
                                                key={cardReq.id}
                                                req={cardReq}
                                                isExpanded={expandedCardId === cardReq.id}
                                                onToggleExpand={() => setExpandedCardId(expandedCardId === cardReq.id ? null : cardReq.id)}
                                                isMenuOpen={menuCardId === cardReq.id}
                                                onToggleMenu={(e) => {
                                                    e.stopPropagation();
                                                    setMenuCardId(menuCardId === cardReq.id ? null : cardReq.id);
                                                }}
                                                onUpdateStatus={handleUpdateStatus}
                                                onCancel={handleCancelLeave}
                                                viewMode="active"
                                                currentTeacherId={typeof window !== 'undefined' ? (localStorage.getItem('dormichan_login_id') || '') : ''}
                                                teacherPosition={teacherPosition}
                                                hideActionButtons={!student.leaveRequest}
                                                borderColor={cardBorder}
                                            />
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom Row: Student Search (Left) & Floor Selector Tabs (Right) */}
                <div className="flex items-center justify-between w-full gap-2">
                    {/* Left: Student Search Box */}
                    <div className="relative flex-1 max-w-[180px] xs:max-w-[220px] sm:max-w-[260px] h-9 sm:h-10">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="🔍 학생 검색..."
                            enterKeyHint="search"
                            autoComplete="off"
                            className="w-full h-full px-3 text-xs sm:text-sm font-medium bg-gray-800/90 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-all shadow-sm"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs font-bold p-1"
                            >
                                ✕
                            </button>
                        )}

                        {/* Dropdown Results */}
                        {searchQuery.trim() && (
                            <div className="absolute left-0 top-full mt-1 min-w-[200px] max-w-[260px] w-auto bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto whitespace-nowrap">
                                {searchResults.length > 0 ? (
                                    searchResults.map((res, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                setCurrentFloor(res.floor);
                                                setSearchQuery('');
                                                toast.success(`${res.displayName} → ${res.roomNum}호 (${res.position === 'left' ? 'L' : 'R'}침대)`);

                                                setTimeout(() => {
                                                    if (transformRef.current) {
                                                        transformRef.current.zoomToElement(`room-${res.roomNum}`, 1.2, 500);
                                                    }
                                                }, 150);
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-orange-600/30 hover:text-white border-b border-gray-800 last:border-0 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                                        >
                                            <span className="font-bold text-white truncate">
                                                {res.displayName}
                                            </span>
                                            <span className="bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded text-[11px] font-mono border border-orange-500/30 shrink-0">
                                                {res.roomNum}호 ({res.position === 'left' ? 'L' : 'R'})
                                            </span>
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-3 py-2 text-xs text-gray-400 text-center">
                                        검색 결과 없음
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right: Floor Selector Tabs */}
                    <div className="flex items-center gap-1 bg-gray-900/90 p-1 rounded-xl border border-gray-700/80 shadow-inner shrink-0 h-9 sm:h-10">
                        {[1, 2, 3, 4].map(floor => (
                            <button
                                key={floor}
                                onClick={() => setCurrentFloor(floor)}
                                className={clsx(
                                    "h-full px-2.5 sm:px-3.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap flex items-center justify-center",
                                    currentFloor === floor
                                        ? "bg-orange-500 text-white shadow-md font-bold scale-105"
                                        : "text-gray-400 hover:text-white hover:bg-gray-800"
                                )}
                            >
                                {floor}F
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {/* Main Content - Zoomable Area */}
            <div
                onClick={handleCanvasClick}
                onDoubleClick={handleCanvasDoubleClick}
                className="flex-1 relative overflow-hidden bg-[#121212] w-full h-full overscroll-y-none"
            >

                <TransformWrapper
                    ref={transformRef}
                    initialScale={0.3}
                    minScale={0.2}
                    maxScale={2}
                    centerOnInit={true}
                    wheel={{ step: 0.1 }}
                    panning={{ disabled: false, velocityDisabled: true }}
                    doubleClick={{ disabled: true }}
                    limitToBounds={true} // This prevents panning "into the void" beyond content edges
                >
                    <TransformComponent
                        wrapperStyle={{ width: "100%", height: "100%" }}
                        contentStyle={{ display: "flex", alignItems: "center", justifyContent: "center" }} // Removed width/height 100% to let content define bounds
                    >
                        <div className="grid grid-cols-5 gap-1.5 min-w-[1000px] select-none px-10 pt-10 pb-40"> {/* Increased bottom padding to prevent clipping */}
                            {Object.keys(currentFloor === 1 ? FLOOR_1_LAYOUT : (currentFloor === 2 ? FLOOR_2_LAYOUT : (currentFloor === 4 ? FLOOR_4_LAYOUT : DEFAULT_LAYOUT))).map((key) => {
                                const idx = Number(key);
                                const roomNum = currentFloor * 100 + idx;
                                const roomData = roomStatus[roomNum] || { left: { status: 'in', name: '', student_id: '' }, right: { status: 'in', name: '', student_id: '' } };

                                const leftGrade = roomData.left.student_id
                                    ? gradeMap.get(roomData.left.student_id) || (/^[1-3]/.test(roomData.left.student_id) ? parseInt(roomData.left.student_id[0], 10) : undefined)
                                    : (/^[1-3]/.test(roomData.left.name) ? parseInt(roomData.left.name[0], 10) : undefined);

                                const rightGrade = roomData.right.student_id
                                    ? gradeMap.get(roomData.right.student_id) || (/^[1-3]/.test(roomData.right.student_id) ? parseInt(roomData.right.student_id[0], 10) : undefined)
                                    : (/^[1-3]/.test(roomData.right.name) ? parseInt(roomData.right.name[0], 10) : undefined);

                                const roomGrade = leftGrade || rightGrade;

                                const layout = currentFloor === 1 ? FLOOR_1_LAYOUT : (currentFloor === 2 ? FLOOR_2_LAYOUT : (currentFloor === 4 ? FLOOR_4_LAYOUT : DEFAULT_LAYOUT));
                                const pos = layout[idx];

                                // Layout helpers based on relative index
                                // Top Row: 6-10 (Side by Side)
                                const isSideBySide = idx >= 6 && idx <= 10;
                                // Left Col (1-5) & Bottom Left (21-25) are Reverse Vertical
                                // NOTE: Floor 1 assumes simple vertical for 21+, Floor 2 different.
                                // Floor 4: Inner is 20-25. Vertical.
                                const isReverseVertical = (idx >= 1 && idx <= 5) || (currentFloor !== 1 && currentFloor !== 2 && currentFloor !== 4 && idx >= 21 && idx <= 25);

                                const FLIPPED_ROOMS = [120, 121, 122, 123, 222, 223, 224, 225, 226, 227, 420, 421, 422, 423, 424, 425];
                                const isFlipped = FLIPPED_ROOMS.includes(roomNum);

                                let flexDirClass = isSideBySide ? "flex-row" : (isReverseVertical ? "flex-col-reverse" : "flex-col");
                                if (isFlipped) {
                                    if (flexDirClass === "flex-row") flexDirClass = "flex-row-reverse";
                                    else if (flexDirClass === "flex-col") flexDirClass = "flex-col-reverse";
                                    else if (flexDirClass === "flex-col-reverse") flexDirClass = "flex-col";
                                }

                                return (
                                    <div
                                        key={roomNum}
                                        id={`room-${roomNum}`}
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
                                        <div className="flex justify-center items-center px-1 py-0.5 shrink-0 gap-1.5">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRoomNumberClick(roomNum);
                                                }}
                                                className={clsx(
                                                    "inline-flex items-center justify-center text-center h-6 px-2.5 rounded-full border border-white/20 bg-white/10 text-white font-extrabold tracking-tight hover:text-yellow-400 hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 shadow-md leading-none",
                                                    isSideBySide ? "text-xs sm:text-sm" : "text-xs sm:text-sm"
                                                )}
                                                title="생활규정 위반 체크"
                                            >
                                                <span className="inline-block -translate-y-[1px]">{roomNum}</span>
                                            </button>
                                            {roomGrade && (
                                                <span className={clsx(
                                                    "inline-flex items-center justify-center text-center h-6 px-2.5 rounded-full border font-extrabold tracking-tight shrink-0 shadow-md leading-none transition-all",
                                                    isSideBySide ? "text-xs sm:text-sm" : "text-xs sm:text-sm",
                                                    roomGrade === 1 && "text-yellow-300 border-yellow-400/50 bg-yellow-500/20",
                                                    roomGrade === 2 && "text-sky-300 border-sky-400/50 bg-sky-500/20",
                                                    roomGrade === 3 && "text-red-300 border-red-400/50 bg-red-500/20"
                                                )}>
                                                    <span className="inline-block -translate-y-[1px]">{roomGrade}학년</span>
                                                </span>
                                            )}
                                        </div>

                                        <div className={clsx(
                                            "flex flex-1 gap-1 h-full",
                                            flexDirClass
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
                                                className={clsx(
                                                    "relative flex-1 rounded-md border flex flex-col items-center justify-center transition-all duration-200 group active:scale-95",
                                                    mode === 'check'
                                                        ? (checkedSlots.has(`${roomNum}-left`)
                                                            ? (roomData.left.leaveType === '외박'
                                                                ? "bg-purple-600 border-yellow-400 border-[3px] shadow-[0_0_15px_rgba(250,204,21,0.5)] z-20"
                                                                : "bg-yellow-400 border-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.6)] z-20")
                                                            : (roomData.left.status === 'out'
                                                                ? (roomData.left.leaveType === '외출'
                                                                    ? "bg-green-600 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]"
                                                                    : "bg-purple-600 border-purple-500 shadow-[0_0_10px_rgba(147,51,234,0.4)]")
                                                                : (roomData.left.name
                                                                    ? (isWeeklyHomeTime(new Date(), specialHolidays) && roomData.left.isWeekend
                                                                        ? "bg-[#1f2937] border-gray-700 font-medium" // Weekly Home
                                                                        : "bg-white border-white shadow-[0_0_12px_rgba(255,255,255,0.6)] z-10") // Present
                                                                    : "bg-[#1c1c1e] border-white/5" // Empty
                                                                )
                                                            )
                                                        )
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
                                                {/* {mode === 'check' && isWeeklyHomeTime(new Date(), specialHolidays) && roomData.left.isWeekend && (
                                                    <div className="absolute inset-0 bg-gray-200/90 z-20 flex items-center justify-center rounded-md" />
                                                )} */}

                                                {/* Student Name */}
                                                <span className={clsx(
                                                    "truncate max-w-full leading-tight px-0.5 sm:px-1 flex flex-col items-center z-30 font-medium",
                                                    mode === 'check' && isWeeklyHomeTime(new Date(), specialHolidays) && roomData.left.isWeekend
                                                        ? "text-gray-400"
                                                        : (
                                                            mode === 'check' && roomData.left.status === 'in' && roomData.left.name
                                                                ? "text-black"
                                                                : (
                                                                    mode === 'check' && roomData.left.status === 'out'
                                                                        ? "text-white"
                                                                        : "text-gray-300"
                                                                )
                                                        ),
                                                    mode === 'assign' && !roomData.left.name && "text-gray-600 text-[10px]"
                                                )}>
                                                    {roomData.left.name ? (
                                                        <div className="flex items-baseline gap-0.5 w-full justify-center relative">
                                                            <span className="text-[9px] sm:text-[10px] opacity-80 font-normal">{(roomData.left.student_id || roomData.left.name).match(/^\d+/)?.[0]}</span>
                                                            <span className="text-[11px] sm:text-[12px] font-bold">{(roomData.left.student_id || roomData.left.name).replace(/^\d+/, '').trim()}</span>
                                                        </div>
                                                    ) : (mode === 'assign' ? '빈 침대' : '-')}
                                                    {mode === 'check' && isWeeklyHomeTime(new Date(), specialHolidays) && roomData.left.isWeekend && (
                                                        <span className="text-[10px] font-bold text-gray-600 mt-0.5">매주귀가</span>
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
                                                className={clsx(
                                                    "relative flex-1 rounded-md border flex flex-col items-center justify-center transition-all duration-200 group active:scale-95",
                                                    mode === 'check'
                                                        ? (checkedSlots.has(`${roomNum}-right`)
                                                            ? (roomData.right.leaveType === '외박'
                                                                ? "bg-purple-600 border-yellow-400 border-[3px] shadow-[0_0_15px_rgba(250,204,21,0.5)] z-20"
                                                                : "bg-yellow-400 border-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.6)] z-20")
                                                            : (roomData.right.status === 'out'
                                                                ? (roomData.right.leaveType === '외출'
                                                                    ? "bg-green-600 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]"
                                                                    : "bg-purple-600 border-purple-500 shadow-[0_0_10px_rgba(147,51,234,0.4)]")
                                                                : (roomData.right.name
                                                                    ? (isWeeklyHomeTime(new Date(), specialHolidays) && roomData.right.isWeekend
                                                                        ? "bg-[#1f2937] border-gray-700 font-medium" // Weekly Home
                                                                        : "bg-white border-white shadow-[0_0_12px_rgba(255,255,255,0.6)] z-10") // Present
                                                                    : "bg-[#1c1c1e] border-white/5" // Empty
                                                                )
                                                            )
                                                        )
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
                                                {/* {mode === 'check' && isWeeklyHomeTime(new Date(), specialHolidays) && roomData.right.isWeekend && (
                                                    <div className="absolute inset-0 bg-gray-200/90 z-20 flex items-center justify-center rounded-md" />
                                                )} */}

                                                {/* Student Name */}
                                                <span className={clsx(
                                                    "truncate max-w-full leading-tight px-0.5 sm:px-1 flex flex-col items-center z-30 font-medium",
                                                    mode === 'check' && isWeeklyHomeTime(new Date(), specialHolidays) && roomData.right.isWeekend
                                                        ? "text-gray-400"
                                                        : (
                                                            mode === 'check' && roomData.right.status === 'in' && roomData.right.name
                                                                ? "text-black"
                                                                : (
                                                                    mode === 'check' && roomData.right.status === 'out'
                                                                        ? "text-white"
                                                                        : "text-gray-300"
                                                                )
                                                        ),
                                                    mode === 'assign' && !roomData.right.name && "text-gray-600 text-[10px]"
                                                )}>
                                                    {roomData.right.name ? (
                                                        <div className="flex items-baseline gap-0.5 w-full justify-center relative">
                                                            <span className="text-[9px] sm:text-[10px] opacity-80 font-normal">{(roomData.right.student_id || roomData.right.name).match(/^\d+/)?.[0]}</span>
                                                            <span className="text-[11px] sm:text-[12px] font-bold">{(roomData.right.student_id || roomData.right.name).replace(/^\d+/, '').trim()}</span>
                                                        </div>
                                                    ) : (mode === 'assign' ? '빈 침대' : '-')}
                                                    {mode === 'check' && isWeeklyHomeTime(new Date(), specialHolidays) && roomData.right.isWeekend && (
                                                        <span className="text-[10px] font-bold text-gray-600 mt-0.5">매주귀가</span>
                                                    )}
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </TransformComponent>
                </TransformWrapper >
            </div >

            {/* Assignment Modal (Identical to seats/page.tsx) */}
            {
                isModalOpen && selectedSlot && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsModalOpen(false)}>
                        <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm transform transition-all scale-100" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-extrabold text-gray-800">
                                    {selectedSlot.room}호 {selectedSlot.position === 'left' ? '왼쪽 침대' : '오른쪽 침대'} 배정
                                </h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
                            </div>

                            <div className="mb-6">
                                <label className="block text-xs font-bold text-gray-400 mb-2">학생 선택 검색</label>
                                <Select
                                    autoFocus
                                    menuPlacement="auto"
                                    options={students
                                        .filter(s => !Object.values(roomStatus).some(r => r.left.student_id === s.student_id || r.right.student_id === s.student_id))
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
                                {roomStatus[selectedSlot.room][selectedSlot.position].student_id && (
                                    <button
                                        onClick={() => assignStudent(null)}
                                        className="px-3 py-1.5 flex-1 bg-red-50 text-red-500 font-bold text-sm rounded-xl hover:bg-red-100 border border-red-100 transition-colors"
                                    >
                                        현재 배정 해제
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-3 py-1.5 flex-1 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                    닫기
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Student History Modal */}
            {
                isHistoryModalOpen && historyStudent && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsHistoryModalOpen(false)}>
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden text-gray-800" onClick={e => e.stopPropagation()}>
                            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <div className="flex items-center gap-3">
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
                                                        const data = await res.json();
                                                        if (res.ok) toast.success('호출 알림을 보냈습니다.');
                                                        else toast.error(data.error || '호출 실패');
                                                    } catch (err) {
                                                        toast.error('오류 발생');
                                                    }
                                                }}
                                                className="text-xl p-1 text-gray-400 hover:text-red-500 transition-colors"
                                                title="호출"
                                            >
                                                🔔
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
                )
            }

            <MorningCheckoutModal
                isOpen={isDisciplineModalOpen}
                onClose={() => setIsDisciplineModalOpen(false)}
                initialSelectedStudentIds={disciplineRoomStudentIds}
                roomNumber={disciplineRoomNum}
            />

            {/* Today Headcount Popup Modal */}
            {isTodayModalOpen && (
                <div
                    className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
                    onClick={() => setIsTodayModalOpen(false)}
                >
                    <div
                        className="bg-[#FDFDFD] text-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-3.5 sm:p-4 bg-gray-900 text-white flex justify-between items-center shadow-md">
                            <div className="flex items-center gap-2.5">
                                <div className="p-[1.5px] rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500">
                                    <div className="p-[1.5px] bg-gray-900 rounded-full">
                                        <img src="/dorm.jpg" alt="Profile" className="w-6 h-6 rounded-full object-cover" />
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm sm:text-base text-white">오늘의 홍지관 인원현황</h3>
                                    <p className="text-[10px] text-gray-400">외박자 · 외출자 및 학년/층별 실시간 현황</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsTodayModalOpen(false)}
                                className="hover:bg-white/20 p-1.5 rounded-full transition-colors text-white font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            <DashboardMain />
                        </div>

                        <div className="p-3 bg-gray-100 border-t border-gray-200 flex justify-end">
                            <button
                                onClick={() => setIsTodayModalOpen(false)}
                                className="px-5 py-2 bg-gray-900 text-white rounded-xl font-bold text-xs hover:bg-gray-800 transition-colors shadow-sm cursor-pointer"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ViolationStatsModal
                isOpen={isViolationModalOpen}
                onClose={() => setIsViolationModalOpen(false)}
                initialFilter="today"
            />
            </div>
        </SwipeWrapper>
    );
}
