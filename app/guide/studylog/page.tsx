'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/supabaseClient';
import { 
    FaArrowLeft, 
    FaRedo, 
    FaSearch, 
    FaCheck, 
    FaTrash, 
    FaEdit, 
    FaPlay, 
    FaHandPointer 
} from 'react-icons/fa';
import { HiHome } from 'react-icons/hi';
import clsx from 'clsx';
import toast, { Toaster } from 'react-hot-toast';

export default function StudyLogGuidePage() {
    const router = useRouter();

    // 1. Real Database State
    const [realSeats, setRealSeats] = useState<any[]>([]);
    const [realProps, setRealProps] = useState<any[]>([]);
    const [allStudents, setAllStudents] = useState<any[]>([]);
    const [layout, setLayout] = useState({ room_number: 1, columns: 6, total_seats: 30 });
    const [isLoadingData, setIsLoadingData] = useState(true);

    // 2. Demo & Simulation State
    const [mode, setMode] = useState<'auto' | 'interactive'>('auto');
    const [stepNumber, setStepNumber] = useState<number>(0);
    const [guideText, setGuideText] = useState('실제 자리배치도 화면에서 시연을 시작합니다...');

    // Pointer Animation State
    const [pointer, setPointer] = useState<{
        show: boolean;
        x: number; // percentage or px
        y: number;
        clicking: boolean;
    }>({ show: false, x: 0, y: 0, clicking: false });

    // 3. Realistic Modal State (100% Mirroring StudyLogModal)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'yanghyeonjae' | 'facility'>('yanghyeonjae');
    const [studentSearchInput, setStudentSearchInput] = useState('');
    const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [detailInput, setDetailInput] = useState('');
    const [facilityInput, setFacilityInput] = useState('');

    // Simulated Log Cards
    const [todayLogs, setTodayLogs] = useState<any[]>([
        {
            id: 991,
            student_id: '2112양서진',
            student_name: '양서진',
            note: '전자기기 위반: 인강 외 유튜브 시청',
            checked_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
            teacher_name: '지도교사'
        }
    ]);

    const timerRefs = useRef<NodeJS.Timeout[]>([]);

    const clearAllTimers = () => {
        timerRefs.current.forEach(clearTimeout);
        timerRefs.current = [];
    };

    // Load Real Data from Supabase
    useEffect(() => {
        async function loadActualDormitoryData() {
            setIsLoadingData(true);
            try {
                const [
                    { data: studentsData },
                    { data: seatAssignments },
                    { data: seatProps },
                    { data: layoutData }
                ] = await Promise.all([
                    supabase.from('students').select('*').order('student_id'),
                    supabase.from('seat_assignments').select('*, student:students(*)').eq('room_number', 1),
                    supabase.from('seats').select('*').eq('room_number', 1),
                    supabase.from('room_layouts').select('*').eq('room_number', 1).maybeSingle()
                ]);

                if (studentsData && studentsData.length > 0) {
                    setAllStudents(studentsData);
                }
                if (seatAssignments && seatAssignments.length > 0) {
                    setRealSeats(seatAssignments);
                }
                if (seatProps) {
                    setRealProps(seatProps);
                }
                if (layoutData) {
                    setLayout(layoutData);
                }
            } catch (err) {
                console.error('Failed to load real seats data:', err);
            } finally {
                setIsLoadingData(false);
            }
        }
        loadActualDormitoryData();
    }, []);

    // Filter Students for Dropdown (Same as StudyLogModal)
    const filteredStudents = React.useMemo(() => {
        const query = studentSearchInput.trim().toLowerCase();
        if (!query) return [];
        return allStudents
            .filter(s => s.student_id?.toLowerCase().includes(query) || s.name?.toLowerCase().includes(query))
            .slice(0, 5);
    }, [allStudents, studentSearchInput]);

    // Start Realistic Auto Demonstration
    const startDemonstration = () => {
        clearAllTimers();
        setMode('auto');

        // 0. Reset State
        setIsModalOpen(false);
        setActiveTab('yanghyeonjae');
        setSelectedStudent(null);
        setStudentSearchInput('');
        setIsSearchDropdownOpen(false);
        setSelectedCategory(null);
        setDetailInput('');
        setTodayLogs([
            {
                id: 991,
                student_id: '2112양서진',
                student_name: '양서진',
                note: '전자기기 위반: 인강 외 유튜브 시청',
                checked_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
                teacher_name: '지도교사'
            }
        ]);
        setStepNumber(1);
        setGuideText('1. 자리배치도 상단의 [학습일지/시설물] 버튼을 터치합니다.');
        setPointer({ show: true, x: 280, y: 115, clicking: false });

        // Step 1 Click Button (at 1.4s)
        const t1 = setTimeout(() => {
            setPointer(p => ({ ...p, clicking: true }));
        }, 1400);

        // Open Modal (at 1.7s)
        const t2 = setTimeout(() => {
            setIsModalOpen(true);
            setPointer({ show: false, x: 0, y: 0, clicking: false });
            setStepNumber(2);
            setGuideText('2. 팝업창이 열립니다. [학생 선택] 검색창에 학생 이름을 검색합니다.');
        }, 1700);

        // Step 2: Focus Search Input & Typing (at 2.4s)
        const t3 = setTimeout(() => {
            setPointer({ show: true, x: 180, y: 190, clicking: false });
        }, 2400);

        // Click search input
        const t4 = setTimeout(() => {
            setPointer(p => ({ ...p, clicking: true }));
            setIsSearchDropdownOpen(true);
        }, 2900);

        // Type '이'
        const t5 = setTimeout(() => {
            setPointer(p => ({ ...p, clicking: false }));
            setStudentSearchInput('이');
            setIsSearchDropdownOpen(true);
        }, 3400);

        // Type '이원'
        const t6 = setTimeout(() => {
            setStudentSearchInput('이원');
        }, 3800);

        // Type '이원규'
        const t7 = setTimeout(() => {
            setStudentSearchInput('이원규');
            setStepNumber(3);
            setGuideText('3. 검색 결과 드롭다운에서 [1313 이원규] 학생을 터치하여 선택합니다.');
        }, 4200);

        // Move pointer to dropdown result
        const t8 = setTimeout(() => {
            setPointer({ show: true, x: 220, y: 260, clicking: false });
        }, 4700);

        // Click dropdown item
        const t9 = setTimeout(() => {
            setPointer(p => ({ ...p, clicking: true }));
            const targetStudent = allStudents.find(s => s.name?.includes('이원규') || s.student_id?.includes('1313')) || {
                student_id: '1313이원규',
                name: '이원규',
                grade: 1,
                class: 3
            };
            setSelectedStudent(targetStudent);
            setIsSearchDropdownOpen(false);
            setStudentSearchInput('');
        }, 5200);

        // Step 4: Select Category [졸음] (at 5.8s)
        const t10 = setTimeout(() => {
            setPointer({ show: true, x: 70, y: 275, clicking: false });
            setStepNumber(4);
            setGuideText('4. 위반 항목 중 [졸음] 항목을 터치합니다.');
        }, 5800);

        // Click [졸음]
        const t11 = setTimeout(() => {
            setPointer(p => ({ ...p, clicking: true }));
            setSelectedCategory('졸음');
        }, 6400);

        // Step 5: Type Detail Message (at 7.0s)
        const t12 = setTimeout(() => {
            setPointer(p => ({ ...p, clicking: false, x: 200, y: 350 }));
            setStepNumber(5);
            setGuideText('5. 상세 지도 내용을 입력합니다. (실시간 타이핑 연출)');
        }, 7000);

        // Detail typing progression
        const textToType = '야간 자습 중 졸음 지도';
        for (let i = 1; i <= textToType.length; i++) {
            const tType = setTimeout(() => {
                setDetailInput(textToType.slice(0, i));
            }, 7400 + i * 90);
            timerRefs.current.push(tType);
        }

        // Step 6: Click Register Button (at 10.0s)
        const t13 = setTimeout(() => {
            setPointer({ show: true, x: 280, y: 440, clicking: false });
            setStepNumber(6);
            setGuideText('6. [위반 사항 등록] 버튼을 눌러 양현재 일지에 기록합니다.');
        }, 10000);

        // Click Register Button
        const t14 = setTimeout(() => {
            setPointer(p => ({ ...p, clicking: true }));
            toast.success('등록되었습니다.');

            // Add Card
            const newLog = {
                id: Date.now(),
                student_id: '1313이원규',
                student_name: '이원규',
                note: '졸음: 야간 자습 중 졸음 지도',
                checked_at: new Date().toISOString(),
                teacher_name: '지도교사'
            };
            setTodayLogs(prev => [newLog, ...prev]);
            setSelectedCategory(null);
            setDetailInput('');
        }, 10700);

        // Step 7: Complete (at 11.5s)
        const t15 = setTimeout(() => {
            setPointer({ show: false, x: 0, y: 0, clicking: false });
            setStepNumber(7);
            setGuideText('✨ 시연이 완료되었습니다! 하단에 등록 카드가 생성되었으며, 우측 상단 ✕로 닫을 수 있습니다.');
        }, 11500);

        timerRefs.current.push(t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15);
    };

    // Auto trigger on initial mount once data ready
    useEffect(() => {
        if (!isLoadingData) {
            const initialTimer = setTimeout(() => {
                startDemonstration();
            }, 500);
            return () => clearTimeout(initialTimer);
        }
    }, [isLoadingData]);

    // Cleanup timers
    useEffect(() => {
        return () => clearAllTimers();
    }, []);

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none relative overflow-x-hidden">
            <Toaster position="top-center" />

            {/* 1. TOP GUIDE BANNER (Floating Control & Step Indicator) */}
            <header className="sticky top-0 z-50 bg-slate-900 text-white shadow-lg border-b border-slate-800">
                <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => router.push('/teacher/seats')}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-bold"
                            title="실제 좌석배치도로 이동"
                        >
                            <FaArrowLeft />
                            <span className="hidden sm:inline">좌석배치도로 돌아가기</span>
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="bg-amber-400 text-slate-950 text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-full">
                                    기능 안내 & 자동 시연
                                </span>
                                <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                                    양현재 일지 및 시설물 수리요청 사용법
                                </h1>
                            </div>
                            <p className="text-xs text-amber-300 font-medium mt-0.5 animate-pulse">
                                {guideText}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={startDemonstration}
                            className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer"
                        >
                            <FaRedo className="text-[10px]" />
                            <span>처음부터 다시 시연</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                clearAllTimers();
                                setPointer({ show: false, x: 0, y: 0, clicking: false });
                                setMode('interactive');
                                setIsModalOpen(true);
                                setGuideText('👉 직접 자유롭게 입력하고 기능을 테스트해보세요.');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                            <FaHandPointer className="text-[10px]" />
                            <span>직접 눌러보기</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* 2. REAL SEAT MANAGEMENT SCREEN MIRROR (100% IDENTICAL TO /teacher/seats) */}
            <main className="flex-1 max-w-5xl w-full mx-auto p-2 sm:p-4 md:p-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Top Seat Header Bar */}
                    <div className="p-3 sm:p-4 border-b border-gray-100 flex flex-col gap-3">
                        {/* Row 1: Back, Room Title & Supervision Info */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 text-sm">
                                    <HiHome />
                                </div>
                                <div>
                                    <h2 className="text-base sm:text-lg font-black text-gray-900 leading-tight">
                                        자리배치도 <span className="text-xs sm:text-sm font-semibold text-gray-400 ml-1">제1실</span>
                                    </h2>
                                    <p className="text-[11px] text-gray-400">
                                        현재 시간: {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} | 담당 교사: 지도교사
                                    </p>
                                </div>
                            </div>

                            {/* Row 2 Buttons: TIP & 학습일지/시설물 */}
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold text-slate-700 bg-white border border-slate-200 shadow-2xs flex items-center gap-1.5 opacity-80 cursor-default"
                                >
                                    <span>학생이 없는 경우</span>
                                    <span className="font-black text-indigo-600 bg-indigo-50 border border-indigo-200 px-1 py-0.5 rounded text-[10px]">
                                        TIP
                                    </span>
                                </button>

                                {/* [학습일지/시설물] Target Button for Simulation */}
                                <div className="relative">
                                    <button
                                        type="button"
                                        id="demo-studylog-btn"
                                        onClick={() => {
                                            if (mode === 'interactive') setIsModalOpen(true);
                                        }}
                                        className={clsx(
                                            "h-9 sm:h-10 px-4 sm:px-5 rounded-xl text-xs sm:text-sm font-extrabold text-slate-800 bg-white border border-slate-300 shadow-xs transition-all flex items-center justify-center gap-1.5",
                                            mode === 'interactive' && "hover:bg-slate-50 cursor-pointer active:scale-95",
                                            stepNumber === 1 && "ring-4 ring-amber-400 ring-offset-2 animate-bounce"
                                        )}
                                    >
                                        <span>학습일지/시설물</span>
                                    </button>

                                    {/* Visual Tooltip Pointer on Step 1 */}
                                    {stepNumber === 1 && (
                                        <div className="absolute -bottom-10 right-0 z-30 whitespace-nowrap bg-amber-400 text-slate-950 font-black text-[11px] px-2.5 py-1 rounded-lg shadow-lg border border-amber-300 animate-pulse">
                                            👇 이 버튼을 터치하세요!
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Row 3: Search & Room Selector Tabs */}
                        <div className="flex items-center justify-between w-full gap-2 pt-1">
                            <div className="relative flex-1 max-w-[220px] h-9">
                                <input
                                    type="text"
                                    readOnly
                                    placeholder="🔍 학생 자리 검색..."
                                    className="w-full h-full px-3 text-xs font-medium bg-gray-50 border border-gray-200 text-gray-500 rounded-xl"
                                />
                            </div>

                            <div className="flex items-center gap-1 bg-gray-200/90 p-1 rounded-xl border border-gray-300/80 shadow-inner h-9">
                                {[1, 2, 3].map(room => (
                                    <span
                                        key={room}
                                        className={clsx(
                                            "h-full px-3 rounded-lg text-xs font-extrabold flex items-center justify-center",
                                            room === 1
                                                ? "bg-yellow-400 text-yellow-950 shadow-md font-black"
                                                : "text-gray-500"
                                        )}
                                    >
                                        제{room}실
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Actual 6-Column Seat Grid */}
                    <div className="p-3 sm:p-4 bg-slate-50/50">
                        {/* Sticky Period Headers */}
                        <div 
                            className="grid gap-0 text-left w-full border-b border-gray-200 mb-1"
                            style={{ gridTemplateColumns: `repeat(${layout.columns || 6}, minmax(0, 1fr))` }}
                        >
                            {Array.from({ length: layout.columns || 6 }).map((_, c) => (
                                <div key={c} className="p-1 h-6 flex items-center bg-gray-100 border-r border-gray-200 text-[10px] text-gray-400 font-bold divide-x divide-gray-200">
                                    {[1, 2, 3, 4].map(p => (
                                        <div key={p} className="flex-1 text-center">{p}</div>
                                    ))}
                                </div>
                            ))}
                        </div>

                        {/* Real Seat Cards (6 Columns) */}
                        <div 
                            className="grid gap-0 text-left w-full border-t border-l border-gray-200 bg-white"
                            style={{ gridTemplateColumns: `repeat(${layout.columns || 6}, minmax(0, 1fr))` }}
                        >
                            {Array.from({ length: layout.total_seats || 30 }).map((_, idx) => {
                                const seatNum = idx + 1;
                                const assignment = realSeats.find(a => a.seat_number === seatNum);
                                const isDisabled = realProps.find(p => p.seat_number === seatNum)?.is_disabled;
                                const student = assignment?.student;

                                return (
                                    <div
                                        key={seatNum}
                                        className={clsx(
                                            "relative flex flex-col border-r border-b border-gray-200 overflow-hidden h-[54px] transition-all",
                                            isDisabled ? "bg-gray-200" : "bg-white",
                                            !assignment && !isDisabled && "bg-gray-50/40"
                                        )}
                                    >
                                        {/* Seat Number Top-Right */}
                                        {!isDisabled && (
                                            <span className="absolute top-0.5 right-1 text-[8px] font-medium text-gray-300">
                                                {seatNum}
                                            </span>
                                        )}

                                        {/* Student Info Top Row */}
                                        {assignment && student ? (
                                            <>
                                                <div className="flex-1 flex items-center px-1.5 border-b border-gray-100 bg-white">
                                                    <span className="font-semibold flex-1 flex items-baseline gap-1 truncate text-gray-800">
                                                        <span className="text-[10px] text-gray-500">
                                                            {student.student_id?.match(/^\d+/)?.[0]}
                                                        </span>
                                                        <span className="text-[12px] font-bold text-gray-900">
                                                            {student.name || student.student_id?.replace(/^\d+/, '')}
                                                        </span>
                                                    </span>
                                                </div>
                                                {/* Bottom Period Row */}
                                                <div className="h-5 flex bg-gray-50/40 divide-x divide-gray-100">
                                                    {[1, 2, 3, 4].map(p => (
                                                        <div key={p} className="flex-1 text-[10px] font-bold text-transparent text-center">
                                                            {p}
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        ) : isDisabled ? (
                                            <div className="flex-1"></div>
                                        ) : (
                                            <div className="flex-1 flex items-center justify-center text-[10px] text-gray-300">
                                                빈자리
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </main>

            {/* 3. REALISTIC STUDYLOG MODAL (100% IDENTICAL DESIGN TO StudyLogModal.tsx) */}
            {isModalOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
                    onClick={() => {
                        if (mode === 'interactive') setIsModalOpen(false);
                    }}
                >
                    <div 
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 relative"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Top Segment Control & Close Button */}
                        <div className="p-3.5 sm:p-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-white shrink-0">
                            {/* Segment Switch */}
                            <div className="flex-1 bg-gray-100 p-1 rounded-2xl flex items-center border border-gray-200/80 shadow-inner">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('yanghyeonjae')}
                                    className={`flex-1 py-2 sm:py-2.5 rounded-xl font-black text-sm sm:text-base transition-all duration-200 cursor-pointer text-center ${
                                        activeTab === 'yanghyeonjae'
                                            ? 'bg-white text-gray-900 shadow-xs'
                                            : 'text-gray-500 hover:text-gray-800'
                                    }`}
                                >
                                    양현재 일지 등록
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('facility')}
                                    className={`flex-1 py-2 sm:py-2.5 rounded-xl font-black text-sm sm:text-base transition-all duration-200 cursor-pointer text-center ${
                                        activeTab === 'facility'
                                            ? 'bg-white text-gray-900 shadow-xs'
                                            : 'text-gray-500 hover:text-gray-800'
                                    }`}
                                >
                                    시설물 수리요청
                                </button>
                            </div>

                            {/* Close Button */}
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer text-base font-bold shrink-0"
                                aria-label="닫기"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-sm">
                            {/* TAB 1: 양현재 일지 등록 */}
                            {activeTab === 'yanghyeonjae' && (
                                <div className="space-y-4">
                                    {/* 1. Student Selection */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                                            <label className="text-xs font-semibold text-gray-600">
                                                학생 선택
                                            </label>
                                            <p className="text-xs text-blue-600 font-semibold flex items-center gap-1">
                                                <span>💡</span>
                                                <span>이름을 모를 땐 좌석을 더블터치하세요.</span>
                                            </p>
                                        </div>

                                        {selectedStudent ? (
                                            <div className="flex items-center justify-between bg-blue-50/60 border border-blue-200 px-3.5 py-2.5 rounded-xl animate-in zoom-in-95 duration-150">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-extrabold text-blue-900">{selectedStudent.student_id}</span>
                                                    <span className="font-bold text-gray-900">{selectedStudent.name}</span>
                                                    <span className="text-xs text-gray-500">
                                                        ({selectedStudent.grade || 1}학년 {selectedStudent.class || 3}반)
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedStudent(null);
                                                        setStudentSearchInput('');
                                                    }}
                                                    className="text-xs text-gray-500 hover:text-gray-900 font-semibold underline cursor-pointer"
                                                >
                                                    변경
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <div className="relative flex items-center">
                                                    <FaSearch className="absolute left-3 text-gray-400 text-xs" />
                                                    <input
                                                        type="text"
                                                        value={studentSearchInput}
                                                        onChange={e => {
                                                            setStudentSearchInput(e.target.value);
                                                            setIsSearchDropdownOpen(true);
                                                        }}
                                                        onFocus={() => setIsSearchDropdownOpen(true)}
                                                        placeholder="학번 또는 이름 검색..."
                                                        className={clsx(
                                                            "w-full bg-gray-50 border rounded-xl pl-8 pr-3 py-2 text-sm text-gray-800 transition-colors",
                                                            stepNumber === 2 ? "border-amber-400 bg-amber-50/20 ring-2 ring-amber-400/50" : "border-gray-200"
                                                        )}
                                                    />
                                                </div>

                                                {/* Student Search Dropdown */}
                                                {isSearchDropdownOpen && (
                                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden divide-y divide-gray-100">
                                                        {(filteredStudents.length > 0 ? filteredStudents : [
                                                            { student_id: '1313이원규', name: '이원규', grade: 1, class: 3 },
                                                            { student_id: '1314이진우', name: '이진우', grade: 1, class: 3 },
                                                            { student_id: '2112양서진', name: '양서진', grade: 2, class: 1 }
                                                        ]).map((st: any) => (
                                                            <button
                                                                key={st.student_id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedStudent(st);
                                                                    setIsSearchDropdownOpen(false);
                                                                    setStudentSearchInput('');
                                                                }}
                                                                className={clsx(
                                                                    "w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-gray-50 cursor-pointer transition-colors",
                                                                    st.name === '이원규' && stepNumber === 3 && "bg-amber-100/60 font-bold"
                                                                )}
                                                            >
                                                                <span className="font-bold text-gray-900">
                                                                    {st.student_id} {st.name}
                                                                </span>
                                                                <span className="text-xs text-gray-400">
                                                                    {st.grade || 1}-{st.class || 3}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* 2. Violation Categories (6 Buttons) */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                            위반 항목
                                        </label>
                                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                                            {['졸음', '전자기기 위반', '무단이석', '지각 입실', '소란', '기타'].map(cat => {
                                                const isSelected = selectedCategory === cat;
                                                return (
                                                    <button
                                                        key={cat}
                                                        type="button"
                                                        onClick={() => setSelectedCategory(isSelected ? null : cat)}
                                                        className={clsx(
                                                            "py-2 px-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer text-center",
                                                            isSelected
                                                                ? "bg-gray-900 text-white border-gray-900 shadow-xs"
                                                                : "bg-white text-gray-700 hover:bg-gray-50 border-gray-200",
                                                            cat === '졸음' && stepNumber === 4 && "ring-2 ring-amber-400"
                                                        )}
                                                    >
                                                        {cat}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 3. Detail Input Field (Always visible) */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                            상세 내용
                                            {selectedCategory && (
                                                <span className="ml-2 font-normal text-gray-500">
                                                    (선택된 항목: <strong className="text-gray-800">[{selectedCategory}]</strong>)
                                                </span>
                                            )}
                                        </label>
                                        <input
                                            type="text"
                                            value={detailInput}
                                            onChange={e => setDetailInput(e.target.value)}
                                            placeholder="예: 야간 자습 중 졸음 지도, 2차 지도 불응 등"
                                            className={clsx(
                                                "w-full bg-gray-50 border rounded-xl px-3.5 py-2.5 text-sm text-gray-800 focus:outline-none focus:bg-white transition-colors",
                                                stepNumber === 5 ? "border-amber-400 bg-amber-50/20 ring-2 ring-amber-400/50" : "border-gray-200"
                                            )}
                                        />
                                    </div>

                                    {/* 4. Submit Button */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!selectedStudent) {
                                                toast.error('학생을 먼저 선택해주세요.');
                                                return;
                                            }
                                            if (!selectedCategory) {
                                                toast.error('위반 항목을 선택해주세요.');
                                                return;
                                            }
                                            toast.success('등록되었습니다.');
                                            const newLog = {
                                                id: Date.now(),
                                                student_id: selectedStudent.student_id,
                                                student_name: selectedStudent.name,
                                                note: detailInput ? `${selectedCategory}: ${detailInput}` : selectedCategory,
                                                checked_at: new Date().toISOString(),
                                                teacher_name: '지도교사'
                                            };
                                            setTodayLogs(prev => [newLog, ...prev]);
                                            setSelectedCategory(null);
                                            setDetailInput('');
                                        }}
                                        className={clsx(
                                            "w-full py-2.5 rounded-xl font-extrabold text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs",
                                            selectedStudent && selectedCategory
                                                ? "bg-gray-900 hover:bg-gray-800 text-white"
                                                : "bg-gray-200 text-gray-400",
                                            stepNumber === 6 && "ring-4 ring-amber-400"
                                        )}
                                    >
                                        <FaCheck className="text-xs" />
                                        <span>위반 사항 등록</span>
                                    </button>

                                    {/* 5. Registered Logs List Section */}
                                    <div className="pt-2 border-t border-gray-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-gray-700">
                                                오늘의 양현재 일지 ({todayLogs.length}건)
                                            </span>
                                            <span className="text-[11px] text-gray-400">
                                                18:00 ~ 익일 09:00 점호 사이클 기준
                                            </span>
                                        </div>

                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {todayLogs.map(log => (
                                                <div 
                                                    key={log.id} 
                                                    className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between gap-3 animate-in slide-in-from-top-1 duration-150"
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-extrabold text-xs text-gray-900">
                                                                {log.student_id}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400">
                                                                {new Date(log.checked_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400">
                                                                (기록: {log.teacher_name})
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-gray-700 font-medium truncate">
                                                            {log.note}
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button 
                                                            type="button" 
                                                            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"
                                                            title="수정"
                                                        >
                                                            <FaEdit className="text-xs" />
                                                        </button>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setTodayLogs(prev => prev.filter(l => l.id !== log.id))}
                                                            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg"
                                                            title="삭제"
                                                        >
                                                            <FaTrash className="text-xs" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: 시설물 수리요청 */}
                            {activeTab === 'facility' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                            수리가 필요한 시설물 내용
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={facilityInput}
                                            onChange={e => setFacilityInput(e.target.value)}
                                            placeholder="예: 1실 15번 학생 책상 형광등 고장, 2층 복도 정수기 누수 등"
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-800 focus:outline-none focus:bg-white resize-none"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!facilityInput.trim()) {
                                                toast.error('내용을 입력해주세요.');
                                                return;
                                            }
                                            toast.success('수리요청이 등록되어 오늘의 홍지관에 반영되었습니다.');
                                            setFacilityInput('');
                                        }}
                                        className="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-extrabold text-sm transition-all cursor-pointer"
                                    >
                                        수리요청 등록
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 4. VIRTUAL TOUCH POINTER & PING ANIMATION */}
            {pointer.show && (
                <div 
                    className="fixed pointer-events-none z-50 transition-all duration-300 ease-out"
                    style={{
                        top: pointer.y,
                        left: pointer.x
                    }}
                >
                    <div className="relative">
                        {/* Ping Wave on Click */}
                        {pointer.clicking && (
                            <span className="absolute -top-3 -left-3 w-12 h-12 bg-amber-400 rounded-full animate-ping opacity-75"></span>
                        )}
                        {/* Finger Cursor */}
                        <div className={clsx(
                            "w-9 h-9 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-xl border-2 border-white transition-transform",
                            pointer.clicking ? "scale-90 bg-amber-500" : "scale-100"
                        )}>
                            <FaHandPointer className="text-sm transform -rotate-12" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
