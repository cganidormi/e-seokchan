'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/supabaseClient';
import { 
    FaSearch, 
    FaCheck, 
    FaTrash, 
    FaEdit, 
    FaPlay, 
    FaHandPointer, 
    FaCog,
    FaBookOpen
} from 'react-icons/fa';
import { HiHome } from 'react-icons/hi';
import clsx from 'clsx';
import toast, { Toaster } from 'react-hot-toast';

export default function StudyLogDemoTutorialPage() {
    const router = useRouter();

    // 1. Real Room 1 DB State
    const [assignments, setAssignments] = useState<any[]>([]);
    const [disabledSeats, setDisabledSeats] = useState<Set<number>>(new Set());
    const [allStudents, setAllStudents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // 2. Demo State
    const [step, setStep] = useState<number>(0);
    const [pointer, setPointer] = useState<{
        show: boolean;
        x: number;
        y: number;
        clicking: boolean;
    }>({ show: false, x: 0, y: 0, clicking: false });

    // 3. Modal State (100% identical to actual StudyLogModal)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'yanghyeonjae' | 'facility'>('yanghyeonjae');
    const [studentSearch, setStudentSearch] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [detailInput, setDetailInput] = useState('');
    const [todayLogs, setTodayLogs] = useState<any[]>([]);

    const timerRefs = useRef<NodeJS.Timeout[]>([]);

    const clearTimers = () => {
        timerRefs.current.forEach(clearTimeout);
        timerRefs.current = [];
    };

    // Load actual Room 1 data from Supabase
    useEffect(() => {
        async function fetchRoom1Data() {
            setIsLoading(true);
            try {
                const [
                    { data: assignData },
                    { data: propsData },
                    { data: studentsData }
                ] = await Promise.all([
                    supabase.from('seat_assignments').select('*, student:students(*)').eq('room_number', 1),
                    supabase.from('seats').select('*').eq('room_number', 1),
                    supabase.from('students').select('*').order('student_id')
                ]);

                if (assignData) setAssignments(assignData);
                if (propsData) {
                    const disabledSet = new Set<number>(
                        propsData.filter(p => p.is_disabled).map(p => p.seat_number)
                    );
                    setDisabledSeats(disabledSet);
                }
                if (studentsData) setAllStudents(studentsData);
            } catch (err) {
                console.error('Error fetching room 1 data:', err);
            } finally {
                setIsLoading(false);
            }
        }
        fetchRoom1Data();
    }, []);

    // Filter Students for dropdown
    const filteredStudents = React.useMemo(() => {
        const query = studentSearch.trim().toLowerCase();
        if (!query) return [];
        return allStudents
            .filter(s => s.student_id?.toLowerCase().includes(query) || s.name?.toLowerCase().includes(query))
            .slice(0, 5);
    }, [allStudents, studentSearch]);

    // Precise Auto Demonstration Flow
    const runDemo = () => {
        clearTimers();

        // 1. Reset state
        setIsModalOpen(false);
        setActiveTab('yanghyeonjae');
        setSelectedStudent(null);
        setStudentSearch('');
        setIsSearchOpen(false);
        setSelectedCategory(null);
        setDetailInput('');
        setTodayLogs([]);
        setStep(1);

        // Calculate button position or use responsive anchor
        // Step 1: Move pointer to [학습일지/시설물] button
        const btn = document.getElementById('actual-studylog-btn');
        const rect = btn?.getBoundingClientRect();
        const btnX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2 + 60;
        const btnY = rect ? rect.top + rect.height / 2 : 120;

        setPointer({ show: true, x: btnX, y: btnY, clicking: false });

        // Step 1 Click (at 1.2s)
        const t1 = setTimeout(() => {
            setPointer(p => ({ ...p, clicking: true }));
        }, 1200);

        // Open Modal (at 1.6s)
        const t2 = setTimeout(() => {
            setIsModalOpen(true);
            setPointer({ show: false, x: 0, y: 0, clicking: false });
            setStep(2);
        }, 1600);

        // Step 2: Target search input (at 2.2s)
        const t3 = setTimeout(() => {
            const inputEl = document.getElementById('actual-search-input');
            const inRect = inputEl?.getBoundingClientRect();
            setPointer({
                show: true,
                x: inRect ? inRect.left + 50 : window.innerWidth / 2 - 80,
                y: inRect ? inRect.top + inRect.height / 2 : 240,
                clicking: false
            });
        }, 2200);

        // Click search input
        const t4 = setTimeout(() => {
            setPointer(p => ({ ...p, clicking: true }));
            setIsSearchOpen(true);
        }, 2700);

        // Typing student name '이'
        const t5 = setTimeout(() => {
            setPointer(p => ({ ...p, clicking: false }));
            setStudentSearch('이');
            setIsSearchOpen(true);
        }, 3200);

        // Typing '이원'
        const t6 = setTimeout(() => {
            setStudentSearch('이원');
        }, 3600);

        // Typing '이원규'
        const t7 = setTimeout(() => {
            setStudentSearch('이원규');
            setStep(3);
        }, 4000);

        // Step 3: Move pointer to dropdown item (at 4.5s)
        const t8 = setTimeout(() => {
            const dropEl = document.getElementById('actual-search-dropdown');
            const dRect = dropEl?.getBoundingClientRect();
            setPointer({
                show: true,
                x: dRect ? dRect.left + 100 : window.innerWidth / 2 - 50,
                y: dRect ? dRect.top + 30 : 310,
                clicking: false
            });
        }, 4500);

        // Click dropdown item
        const t9 = setTimeout(() => {
            setPointer(p => ({ ...p, clicking: true }));
            const found = allStudents.find(s => s.name?.includes('이원규') || s.student_id?.includes('1313')) || {
                student_id: '1313',
                name: '이원규',
                grade: 1,
                class: 3
            };
            setSelectedStudent(found);
            setIsSearchOpen(false);
            setStudentSearch('');
            setStep(4);
        }, 5000);

        // Step 4: Move pointer to [졸음] category button (at 5.6s)
        const t10 = setTimeout(() => {
            const catBtn = document.getElementById('cat-btn-졸음');
            const cRect = catBtn?.getBoundingClientRect();
            setPointer({
                show: true,
                x: cRect ? cRect.left + cRect.width / 2 : window.innerWidth / 2 - 120,
                y: cRect ? cRect.top + cRect.height / 2 : 380,
                clicking: false
            });
        }, 5600);

        // Click [졸음]
        const t11 = setTimeout(() => {
            setPointer(p => ({ ...p, clicking: true }));
            setSelectedCategory('졸음');
            setStep(5);
        }, 6200);

        // Step 5: Focus detail input & Typing (at 6.8s)
        const t12 = setTimeout(() => {
            const detEl = document.getElementById('actual-detail-input');
            const dtRect = detEl?.getBoundingClientRect();
            setPointer({
                show: true,
                x: dtRect ? dtRect.left + 40 : window.innerWidth / 2,
                y: dtRect ? dtRect.top + dtRect.height / 2 : 510,
                clicking: false
            });
        }, 6800);

        // Detail text typing
        const textToType = '야간 자습 중 졸음 지도';
        for (let i = 1; i <= textToType.length; i++) {
            const tType = setTimeout(() => {
                setDetailInput(textToType.slice(0, i));
            }, 7200 + i * 85);
            timerRefs.current.push(tType);
        }

        // Step 6: Move pointer to [등록] button (at 9.8s)
        const t13 = setTimeout(() => {
            const regBtn = document.getElementById('actual-submit-btn');
            const rRect = regBtn?.getBoundingClientRect();
            setPointer({
                show: true,
                x: rRect ? rRect.left + rRect.width / 2 : window.innerWidth / 2 + 150,
                y: rRect ? rRect.top + rRect.height / 2 : 510,
                clicking: false
            });
            setStep(6);
        }, 9800);

        // Click [등록] Button (at 10.4s)
        const t14 = setTimeout(() => {
            setPointer(p => ({ ...p, clicking: true }));
            toast.success('등록되었습니다.');

            // Generate card in list
            const newCard = {
                id: Date.now(),
                student_id: '1313 이원규',
                category: '졸음',
                detail: '야간 자습 중 졸음 지도',
                time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                teacher: '지도교사'
            };
            setTodayLogs([newCard]);
            setSelectedCategory(null);
            setDetailInput('');
            setStep(7);
        }, 10400);

        // Step 7: Completed (at 11.2s)
        const t15 = setTimeout(() => {
            setPointer({ show: false, x: 0, y: 0, clicking: false });
        }, 11200);

        timerRefs.current.push(t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15);
    };

    // Auto trigger once data ready
    useEffect(() => {
        if (!isLoading) {
            const init = setTimeout(() => runDemo(), 300);
            return () => clearTimeout(init);
        }
    }, [isLoading]);

    useEffect(() => {
        return () => clearTimers();
    }, []);

    return (
        <div className="min-h-screen bg-gray-100 font-sans select-none relative">
            <Toaster position="top-center" />

            {/* TOP BAR: ONLY A CLEAN '시연 재생' BUTTON */}
            <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200 py-2.5 px-4 flex items-center justify-between shadow-xs">
                <button
                    type="button"
                    onClick={() => router.push('/teacher/seats')}
                    className="text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
                >
                    ← 좌석배치도 복귀
                </button>

                <button
                    type="button"
                    onClick={runDemo}
                    className="px-4 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-yellow-950 font-black text-sm flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                >
                    <FaPlay className="text-xs" />
                    <span>시연재생</span>
                </button>

                <div className="w-16"></div>
            </div>

            {/* ACTUAL SEATS PAGE: ROOM 1 (100% IDENTICAL TO app/teacher/seats/page.tsx) */}
            <div className="p-3.5 sm:p-4 md:p-6 pb-16 sm:pb-20 bg-gray-100 min-h-screen">
                <div className="flex flex-col w-full max-w-6xl mx-auto">
                    {/* Header & Controls (Exact same markup from seats/page.tsx line 1010) */}
                    <div className="flex flex-col gap-2.5 sm:gap-3 mb-4">
                        {/* Row 1: Title, Center Home Button & Seat Management Toggle */}
                        <div className="relative flex items-center justify-between gap-1 sm:gap-2 w-full min-h-[36px]">
                            {/* Left: Title */}
                            <div className="flex items-center gap-1.5 shrink-0 min-w-0 z-10">
                                <div className="w-[3px] h-5 bg-yellow-400 rounded-full shrink-0"></div>
                                <h1 className="text-base sm:text-xl font-black text-gray-800 whitespace-nowrap">
                                    현황모니터
                                </h1>
                            </div>

                            {/* Center: Navigation Cluster (오늘의 홍지관 | 홈 | 호실배치도) */}
                            <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 sm:gap-2.5 z-10 pointer-events-auto">
                                <div className="h-11 sm:h-12 w-11 sm:w-12 p-[2px] rounded-xl bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 shadow-sm flex items-center justify-center">
                                    <div className="w-full h-full rounded-[10px] overflow-hidden bg-white">
                                        <img
                                            src="/dorm.jpg"
                                            alt="오늘의 홍지관"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                </div>

                                <div className="h-11 sm:h-12 w-11 sm:w-12 rounded-xl bg-white border border-gray-200 text-gray-900 shadow-sm flex items-center justify-center">
                                    <HiHome className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
                                </div>

                                <div className="h-11 sm:h-12 w-11 sm:w-12 rounded-xl overflow-hidden border border-gray-200 shadow-sm flex items-center justify-center p-0 bg-slate-900 relative">
                                    <img
                                        src="/kshs_building.png"
                                        alt="호실"
                                        className="w-full h-full object-cover brightness-115 contrast-105"
                                        style={{ objectPosition: '25% 12%' }}
                                    />
                                    <div className="absolute inset-0 bg-black/15 flex items-center justify-center pointer-events-none">
                                        <span className="text-white font-black text-xs sm:text-[13px] tracking-tight leading-none drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.9)]">
                                            호실
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Right: Seat Management Toggle Button */}
                            <div className="flex items-center justify-end shrink-0 z-10">
                                <div className="flex items-center bg-gray-200/90 p-1 rounded-xl border border-gray-300/80 shadow-inner shrink-0">
                                    <div className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-extrabold bg-white text-gray-700 shadow-sm flex items-center gap-1.5">
                                        <span>⚙️ 좌석 관리</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Row 2: Swipe Nudge Dots */}
                        <div className="flex items-center justify-center w-full">
                            <div className="bg-gray-200/70 py-1.5 px-4 rounded-full shadow-inner flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                <span className="w-3 h-1.5 rounded-full bg-slate-800"></span>
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                            </div>
                        </div>

                        {/* Row: Supervision Tip Button & Study Log Button */}
                        <div className="flex items-center justify-center w-full gap-2 sm:gap-2.5">
                            <button
                                type="button"
                                className="h-9 sm:h-10 px-4 sm:px-5 rounded-xl text-xs sm:text-sm font-extrabold text-slate-800 bg-white border border-slate-300 shadow-xs flex items-center justify-center gap-1.5"
                            >
                                <span>학생이 없는 경우</span>
                                <span className="font-black text-indigo-600 bg-indigo-50 border border-indigo-200/70 px-1.5 py-0.5 rounded text-[11px] tracking-wide leading-none">
                                    TIP
                                </span>
                            </button>

                            {/* TARGET BUTTON: [학습일지/시설물] */}
                            <button
                                type="button"
                                id="actual-studylog-btn"
                                onClick={() => setIsModalOpen(true)}
                                className={clsx(
                                    "h-9 sm:h-10 px-4 sm:px-5 rounded-xl text-xs sm:text-sm font-extrabold text-slate-800 bg-white border border-slate-300 shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                                    step === 1 && "ring-4 ring-yellow-400 ring-offset-2 animate-bounce"
                                )}
                            >
                                <span>학습일지/시설물</span>
                            </button>
                        </div>

                        {/* Row 3: Student Search (Left) & Room Selector Tabs (Right, Room 1 Selected) */}
                        <div className="flex items-center justify-between w-full gap-2">
                            {/* Left: Student Search Box */}
                            <div className="relative flex-1 max-w-[180px] xs:max-w-[220px] sm:max-w-[260px] h-9 sm:h-10">
                                <div className="relative flex items-center h-full">
                                    <input
                                        type="text"
                                        readOnly
                                        placeholder="🔍 학생 자리 검색..."
                                        className="w-full h-full px-3 text-xs sm:text-sm font-medium bg-white border border-gray-300 text-gray-800 rounded-xl focus:outline-none shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* Right: Room Selector Segment Tabs (ROOM 1 ACTIVATED) */}
                            <div className="flex items-center gap-1 bg-gray-200/90 p-1 rounded-xl border border-gray-300/80 shadow-inner shrink-0 h-9 sm:h-10">
                                <button
                                    type="button"
                                    className="h-full px-2.5 sm:px-3.5 rounded-lg text-xs sm:text-sm font-black bg-yellow-400 text-yellow-950 shadow-md flex items-center justify-center"
                                >
                                    제1실
                                </button>
                                <button
                                    type="button"
                                    className="h-full px-2.5 sm:px-3.5 rounded-lg text-xs sm:text-sm font-extrabold text-gray-600 flex items-center justify-center"
                                >
                                    제2실
                                </button>
                                <button
                                    type="button"
                                    className="h-full px-2.5 sm:px-3.5 rounded-lg text-xs sm:text-sm font-extrabold text-gray-600 flex items-center justify-center"
                                >
                                    제3실
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Actual Room 1 Grid (6 Columns, Sticky Period Numbers) */}
                    <div className="min-h-[500px]">
                        <div className="w-full">
                            {/* Sticky Header Row: 1 2 3 4 across 6 columns */}
                            <div
                                className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b-2 border-gray-100 shadow-sm grid gap-0 text-left w-full"
                                style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}
                            >
                                {[1, 2, 3, 4, 5, 6].map(colIdx => (
                                    <div key={colIdx} className="p-1 h-[24px] flex items-center bg-gray-50 border-r border-gray-100 last:border-r-0">
                                        <div className="w-full flex h-full items-center text-[10px] text-gray-400 font-bold divide-x divide-gray-200">
                                            {[1, 2, 3, 4].map(p => (
                                                <div key={p} className="flex-1 text-center flex items-center justify-center">
                                                    {p}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Seat Grid Cells: 30 Seats */}
                            <div
                                className="grid gap-0 text-left w-full border-t border-l border-gray-200 bg-white"
                                style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}
                            >
                                {Array.from({ length: 30 }).map((_, idx) => {
                                    const seatNum = idx + 1;
                                    const assignment = assignments.find(a => a.seat_number === seatNum);
                                    const isDisabled = disabledSeats.has(seatNum);
                                    const student = assignment?.student;

                                    if (isDisabled) {
                                        return (
                                            <div
                                                key={seatNum}
                                                className="relative w-full h-[54px] bg-[#d5dbe1] border-r border-b border-gray-200"
                                            ></div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={seatNum}
                                            className={clsx(
                                                "relative flex flex-col border-r border-b border-gray-200 overflow-hidden w-full h-[54px] select-none",
                                                !assignment && "bg-gray-50/50"
                                            )}
                                        >
                                            {/* Seat Number on Top-Right */}
                                            <span className="absolute top-0.5 right-1 text-[8px] font-medium text-gray-300 z-20">
                                                {seatNum}
                                            </span>

                                            {assignment && student ? (
                                                <>
                                                    {/* Top Section: Student ID & Name */}
                                                    <div className="flex-1 flex items-center px-1.5 border-b border-gray-100 bg-white">
                                                        <span className="font-medium flex-1 flex items-baseline gap-1 truncate text-gray-800">
                                                            <span className="text-[9px] sm:text-[10px] opacity-90 text-gray-500">
                                                                {student.student_id?.match(/^\d+/)?.[0]}
                                                            </span>
                                                            <span className="text-[11px] sm:text-[12px] font-bold text-gray-900">
                                                                {student.name || student.student_id?.replace(/^\d+/, '')}
                                                            </span>
                                                        </span>
                                                    </div>

                                                    {/* Bottom Section: Period Blocks */}
                                                    <div className="h-5 flex bg-gray-50/30 divide-x divide-gray-100">
                                                        {[1, 2, 3, 4].map(p => (
                                                            <div key={p} className="flex-1 text-[10px] font-bold text-transparent text-center">
                                                                {p}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
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
                </div>
            </div>

            {/* ACTUAL STUDYLOG MODAL (100% IDENTICAL DESIGN TO StudyLogModal.tsx) */}
            {isModalOpen && (
                <div 
                    className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
                    onClick={() => setIsModalOpen(false)}
                >
                    <div 
                        className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Top Bar: Toggle Segment Control & Close Button */}
                        <div className="p-3.5 sm:p-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-white shrink-0">
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

                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer text-base font-bold shrink-0"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
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
                                    <div className="flex items-center justify-between bg-blue-50/70 border border-blue-200 px-3.5 py-2.5 rounded-xl animate-in zoom-in-95 duration-150">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-blue-900">{selectedStudent.student_id}</span>
                                            <span className="font-medium text-gray-900">{selectedStudent.name}</span>
                                            <span className="text-xs text-gray-500">({selectedStudent.grade}학년 {selectedStudent.class}반)</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedStudent(null);
                                                setStudentSearch('');
                                            }}
                                            className="text-xs text-gray-500 hover:text-gray-800 underline cursor-pointer font-semibold"
                                        >
                                            변경
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <div className="relative flex items-center">
                                            <FaSearch className="absolute left-3 text-gray-400 text-xs" />
                                            <input
                                                id="actual-search-input"
                                                type="text"
                                                value={studentSearch}
                                                onChange={e => {
                                                    setStudentSearch(e.target.value);
                                                    setIsSearchOpen(true);
                                                }}
                                                onFocus={() => setIsSearchOpen(true)}
                                                placeholder="학번 또는 이름 검색..."
                                                className={clsx(
                                                    "w-full bg-gray-50 border rounded-xl pl-8 pr-3 py-2 text-sm text-gray-800 focus:outline-none transition-colors",
                                                    step === 2 ? "border-yellow-400 bg-yellow-50/20 ring-2 ring-yellow-400" : "border-gray-200"
                                                )}
                                            />
                                        </div>

                                        {/* Dropdown Results */}
                                        {isSearchOpen && (
                                            <div
                                                id="actual-search-dropdown"
                                                className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden divide-y divide-gray-100"
                                            >
                                                {(filteredStudents.length > 0 ? filteredStudents : [
                                                    { student_id: '1313', name: '이원규', grade: 1, class: 3 },
                                                    { student_id: '1314', name: '이진우', grade: 1, class: 3 }
                                                ]).map((student: any) => (
                                                    <button
                                                        key={student.student_id}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedStudent(student);
                                                            setIsSearchOpen(false);
                                                            setStudentSearch('');
                                                        }}
                                                        className={clsx(
                                                            "w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-gray-50 cursor-pointer transition-colors",
                                                            student.name === '이원규' && step === 3 && "bg-yellow-100 font-bold"
                                                        )}
                                                    >
                                                        <span className="font-medium text-gray-900">
                                                            {student.student_id} {student.name}
                                                        </span>
                                                        <span className="text-xs text-gray-400">
                                                            {student.grade}-{student.class}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* 2. Violation Categories (2x3 Grid from user screenshot) */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                    위반 항목
                                </label>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {['졸음', '전자기기 위반', '무단이석', '지각 입실', '소란', '기타'].map(cat => {
                                        const isSelected = selectedCategory === cat;
                                        return (
                                            <button
                                                key={cat}
                                                id={`cat-btn-${cat}`}
                                                type="button"
                                                onClick={() => setSelectedCategory(isSelected ? null : cat)}
                                                className={clsx(
                                                    "py-2 px-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer text-center",
                                                    isSelected
                                                        ? "bg-gray-900 text-white border-gray-900 shadow-xs"
                                                        : "bg-white text-gray-700 hover:bg-gray-50 border-gray-200",
                                                    cat === '졸음' && step === 4 && "ring-2 ring-yellow-400"
                                                )}
                                            >
                                                {cat}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 3. Detail Input with Inline Tag & Submit Button */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                    상세 내용 기입
                                </label>
                                <div className="bg-gray-50/70 border border-gray-200 rounded-xl p-1.5 flex items-center gap-1.5">
                                    {/* Category Tag */}
                                    <div className={clsx(
                                        "px-2.5 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all",
                                        selectedCategory
                                            ? "bg-gray-900 text-white"
                                            : "border border-dashed border-gray-300 text-gray-400 bg-white"
                                    )}>
                                        {selectedCategory || '항목 미선택'}
                                    </div>

                                    {/* Input */}
                                    <input
                                        id="actual-detail-input"
                                        type="text"
                                        value={detailInput}
                                        onChange={e => setDetailInput(e.target.value)}
                                        placeholder="위반 항목을 위에서 선택하고 상세 내용을 입력하세요"
                                        className={clsx(
                                            "flex-1 bg-white border rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none transition-colors",
                                            step === 5 ? "border-yellow-400 ring-2 ring-yellow-400/60" : "border-gray-200"
                                        )}
                                    />

                                    {/* Submit Button */}
                                    <button
                                        id="actual-submit-btn"
                                        type="button"
                                        onClick={() => {
                                            if (!selectedStudent || !selectedCategory) return;
                                            toast.success('등록되었습니다.');
                                            const newCard = {
                                                id: Date.now(),
                                                student_id: `${selectedStudent.student_id} ${selectedStudent.name}`,
                                                category: selectedCategory,
                                                detail: detailInput || selectedCategory,
                                                time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                                                teacher: '지도교사'
                                            };
                                            setTodayLogs([newCard]);
                                            setSelectedCategory(null);
                                            setDetailInput('');
                                        }}
                                        className={clsx(
                                            "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer",
                                            selectedCategory
                                                ? "bg-gray-900 text-white hover:bg-gray-800"
                                                : "bg-gray-400 text-white",
                                            step === 6 && "ring-4 ring-yellow-400"
                                        )}
                                    >
                                        등록
                                    </button>
                                </div>
                            </div>

                            {/* 4. Registered Card List */}
                            <div className="pt-2 border-t border-gray-100">
                                <span className="block text-xs font-bold text-gray-700 mb-2">
                                    오늘 등록 내역 ({todayLogs.length}건)
                                </span>

                                {todayLogs.length === 0 ? (
                                    <div className="py-6 text-center text-xs text-gray-400">
                                        등록된 내역이 없습니다.
                                    </div>
                                ) : (
                                    <div className="space-y-2 animate-in slide-in-from-top-1">
                                        {todayLogs.map(log => (
                                            <div
                                                key={log.id}
                                                className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between text-xs"
                                            >
                                                <div>
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <span className="font-extrabold text-gray-900">{log.student_id}</span>
                                                        <span className="bg-gray-900 text-white text-[10px] px-1.5 py-0.2 rounded font-bold">
                                                            {log.category}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400">{log.time}</span>
                                                        <span className="text-[10px] text-gray-400">(기록: {log.teacher})</span>
                                                    </div>
                                                    <p className="text-gray-700 font-medium">{log.detail}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setTodayLogs([])}
                                                    className="text-gray-400 hover:text-red-500 p-1"
                                                >
                                                    <FaTrash className="text-xs" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
                            <button
                                type="button"
                                onClick={() => runDemo()}
                                className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline flex items-center gap-1 cursor-pointer"
                            >
                                <FaBookOpen className="text-xs" />
                                <span>사용 가이드 보기</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-1.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 cursor-pointer bg-white"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* VIRTUAL TOUCH POINTER & PING */}
            {pointer.show && (
                <div 
                    className="fixed pointer-events-none z-50 transition-all duration-300 ease-out"
                    style={{
                        top: pointer.y,
                        left: pointer.x
                    }}
                >
                    <div className="relative">
                        {pointer.clicking && (
                            <span className="absolute -top-3 -left-3 w-12 h-12 bg-yellow-400 rounded-full animate-ping opacity-75"></span>
                        )}
                        <div className={clsx(
                            "w-9 h-9 rounded-full bg-yellow-400 text-slate-950 flex items-center justify-center shadow-2xl border-2 border-white transition-transform",
                            pointer.clicking ? "scale-90 bg-yellow-500" : "scale-100"
                        )}>
                            <FaHandPointer className="text-sm transform -rotate-12" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
