'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
    FaSearch, 
    FaCheck, 
    FaTrash, 
    FaEdit, 
    FaRedo, 
    FaHandPointer, 
    FaArrowLeft, 
    FaCog,
    FaBookOpen
} from 'react-icons/fa';
import { HiHome } from 'react-icons/hi';
import clsx from 'clsx';
import toast, { Toaster } from 'react-hot-toast';

export default function PerfectRealisticStudyLogGuidePage() {
    const router = useRouter();

    // Demo Mode
    const [mode, setMode] = useState<'auto' | 'interactive'>('auto');
    const [stepNumber, setStepNumber] = useState<number>(0);
    const [guideText, setGuideText] = useState('실제 자리배치도 화면에서 시연을 시작합니다...');

    // Virtual Touch Pointer
    const [pointer, setPointer] = useState<{
        show: boolean;
        x: number;
        y: number;
        clicking: boolean;
    }>({ show: false, x: 0, y: 0, clicking: false });

    // Modal Simulation State (100% identical to user screenshot #2)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'yanghyeonjae' | 'facility'>('yanghyeonjae');
    const [studentSearchInput, setStudentSearchInput] = useState('');
    const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [detailInput, setDetailInput] = useState('');
    const [facilityInput, setFacilityInput] = useState('');

    // Registered List
    const [todayLogs, setTodayLogs] = useState<any[]>([]);

    const timerRefs = useRef<NodeJS.Timeout[]>([]);

    const clearAllTimers = () => {
        timerRefs.current.forEach(clearTimeout);
        timerRefs.current = [];
    };

    // Candidate Students for Search Dropdown
    const candidateStudents = [
        { student_id: '1313', name: '이원규', grade: 1, class: 3 },
        { student_id: '3212', name: '이민찬', grade: 3, class: 2 },
        { student_id: '3107', name: '김지원', grade: 3, class: 1 },
        { student_id: '3301', name: '김담휘', grade: 3, class: 3 },
        { student_id: '2112', name: '양서진', grade: 2, class: 1 }
    ];

    const filteredStudents = candidateStudents.filter(s =>
        studentSearchInput.trim() && (s.name.includes(studentSearchInput) || s.student_id.includes(studentSearchInput))
    );

    // Exact Grid Data From User's Screenshot #1 (Room 3, 30 Seats, 6 Columns x 5 Rows)
    const seatsData = [
        // Row 1 (Seats 1-6)
        { seat: null, disabled: true }, // Col 1 deadspace
        { seat: null, disabled: true }, // Col 2 deadspace
        { seat: 1, id: '3212', name: '이민찬', color: 'blue', badges: ['컴', '컴'], disabled: false },
        { seat: 2, id: '3211', name: '이동륜', color: 'white', badges: ['', '', '', ''], disabled: false },
        { seat: 3, id: '3210', name: '이강현', color: 'white', badges: ['', '', '', ''], disabled: false },
        { seat: null, disabled: true }, // Col 6 deadspace

        // Row 2 (Seats 7-12)
        { seat: null, disabled: true }, // Col 1 deadspace
        { seat: null, disabled: true }, // Col 2 deadspace
        { seat: 4, id: '3213', name: '임승준', color: 'blue', badges: ['컴', '컴', '컴', '컴'], disabled: false },
        { seat: 5, id: '3214', name: '정하민', color: 'white', badges: ['컴'], disabled: false },
        { seat: 6, id: '3209', name: '유승원', color: 'blue', badges: ['컴', '컴', '컴', '컴'], disabled: false },
        { seat: 7, id: '3207', name: '심민섭', color: 'white', badges: ['', '', '', ''], disabled: false },

        // Row 3 (Seats 13-18)
        { seat: 8, id: '3103', name: '김나람', color: 'white', badges: ['', '', '', ''], disabled: false },
        { seat: null, disabled: true }, // Col 2 deadspace
        { seat: null, disabled: true }, // Col 3 deadspace
        { seat: null, disabled: true }, // Col 4 deadspace
        { seat: null, disabled: true }, // Col 5 deadspace
        { seat: null, disabled: true }, // Col 6 deadspace

        // Row 4 (Seats 19-24)
        { seat: 9, id: '3202', name: '권하늬', color: 'white', badges: ['', '', '', ''], disabled: false },
        { seat: null, disabled: true }, // Col 2 deadspace
        { seat: 10, id: '3206', name: '송유찬', color: 'white', badges: ['이', '이'], disabled: false },
        { seat: 11, id: '3205', name: '박기동', color: 'white', badges: ['', '', '', ''], disabled: false },
        { seat: 12, id: '3203', name: '김영균', color: 'white', badges: ['이', '이'], disabled: false },
        { seat: 13, id: '3201', name: '권민기', color: 'white', badges: ['', '', '', ''], disabled: false },

        // Row 5 (Seats 25-30)
        { seat: 14, id: '3114', name: '정효림', color: 'blue', badges: ['출', '컴', '컴', '컴'], disabled: false },
        { seat: null, disabled: true },
        { seat: 15, id: '3101', name: '강승원', color: 'white', badges: ['이', '이'], disabled: false },
        { seat: 16, id: '3115', name: '허강현', color: 'white', badges: ['', '', '', ''], disabled: false },
        { seat: 17, id: '3104', name: '김민준', color: 'white', badges: ['이', '이'], disabled: false },
        { seat: 18, id: '3106', name: '김승호', color: 'blue', badges: ['컴', '컴', '컴'], disabled: false },

        // Row 6
        { seat: 19, id: '3105', name: '김소희', color: 'white', badges: ['이', '이'], disabled: false },
        { seat: null, disabled: true },
        { seat: null, disabled: true },
        { seat: null, disabled: true },
        { seat: null, disabled: true },
        { seat: null, disabled: true },

        // Row 7
        { seat: 20, id: '3110', name: '원재인', color: 'white', badges: ['', '', '', ''], disabled: false },
        { seat: null, disabled: true },
        { seat: 21, id: '3116', name: '홍진기', color: 'white', badges: ['', '', '', ''], disabled: false },
        { seat: 22, id: '3107', name: '김지원', color: 'red', badges: ['비'], disabled: false }, // Red Leave!
        { seat: 23, id: '3108', name: '김진우', color: 'white', badges: ['', '', '', ''], disabled: false },
        { seat: 24, id: '3109', name: '박서진', color: 'white', badges: ['', '', '', ''], disabled: false },

        // Row 8
        { seat: 25, id: '3112', name: '유초비', color: 'blue', badges: ['이', '이', '컴', '컴'], disabled: false },
        { seat: null, disabled: true },
        { seat: 26, id: '3102', name: '곽호영', color: 'white', badges: ['', '', '', ''], disabled: false },
        { seat: 27, id: '3113', name: '임지승', color: 'blue', badges: ['이', '이', '컴', '컴'], disabled: false },
        { seat: 28, id: '3111', name: '유성재', color: 'white', badges: ['', '', '', ''], disabled: false },
        { seat: 29, id: '3301', name: '김담휘', color: 'red', badges: ['비'], disabled: false } // Red Leave!
    ];

    // Demonstration Sequence
    const runDemo = () => {
        clearAllTimers();
        setMode('auto');

        // Reset
        setIsModalOpen(false);
        setActiveTab('yanghyeonjae');
        setSelectedStudent(null);
        setStudentSearchInput('');
        setIsSearchDropdownOpen(false);
        setSelectedCategory(null);
        setDetailInput('');
        setTodayLogs([]);
        setStepNumber(1);
        setGuideText('1. 자리배치도 상단의 [학습일지/시설물] 버튼을 터치합니다.');
        setPointer({ show: true, x: 280, y: 155, clicking: false });

        // Step 1: Click [학습일지/시설물] Button (1.4s)
        const t1 = setTimeout(() => {
            setPointer(p => ({ ...p, clicking: true }));
        }, 1400);

        // Open Modal (1.8s)
        const t2 = setTimeout(() => {
            setIsModalOpen(true);
            setPointer({ show: false, x: 0, y: 0, clicking: false });
            setStepNumber(2);
            setGuideText('2. 실제와 똑같은 팝업창이 열립니다. [학번 또는 이름 검색...] 창을 터치합니다.');
        }, 1800);

        // Step 2: Focus Search Input (2.6s)
        const t3 = setTimeout(() => {
            setPointer({ show: true, x: 190, y: 245, clicking: false });
        }, 2600);

        const t4 = setTimeout(() => {
            setPointer(p => ({ ...p, clicking: true }));
            setIsSearchDropdownOpen(true);
        }, 3100);

        // Typing '이'
        const t5 = setTimeout(() => {
            setPointer(p => ({ ...p, clicking: false }));
            setStudentSearchInput('이');
            setIsSearchDropdownOpen(true);
        }, 3600);

        // Typing '이원'
        const t6 = setTimeout(() => {
            setStudentSearchInput('이원');
        }, 4000);

        // Typing '이원규'
        const t7 = setTimeout(() => {
            setStudentSearchInput('이원규');
            setStepNumber(3);
            setGuideText('3. 검색 결과에서 [1313 이원규] 학생을 터치하여 선택합니다.');
        }, 4400);

        // Move to dropdown item
        const t8 = setTimeout(() => {
            setPointer({ show: true, x: 210, y: 310, clicking: false });
        }, 4900);

        // Click dropdown item
        const t9 = setTimeout(() => {
            setPointer(p => ({ ...p, clicking: true }));
            setSelectedStudent({ student_id: '1313', name: '이원규', grade: 1, class: 3 });
            setIsSearchDropdownOpen(false);
            setStudentSearchInput('');
        }, 5400);

        // Step 4: Select [졸음] (6.0s)
        const t10 = setTimeout(() => {
            setPointer({ show: true, x: 120, y: 385, clicking: false });
            setStepNumber(4);
            setGuideText('4. 위반 항목에서 [졸음] 버튼을 터치합니다.');
        }, 6000);

        const t11 = setTimeout(() => {
            setPointer(p => ({ ...p, clicking: true }));
            setSelectedCategory('졸음');
        }, 6600);

        // Step 5: Type Detail into Input (7.4s)
        const t12 = setTimeout(() => {
            setPointer(p => ({ ...p, clicking: false, x: 230, y: 520 }));
            setStepNumber(5);
            setGuideText('5. 상세 내용 입력창에 지도 내용을 입력합니다. (실시간 타이핑 연출)');
        }, 7400);

        const textToType = '야간 자습 중 졸음 지도';
        for (let i = 1; i <= textToType.length; i++) {
            const tType = setTimeout(() => {
                setDetailInput(textToType.slice(0, i));
            }, 7800 + i * 90);
            timerRefs.current.push(tType);
        }

        // Step 6: Click [등록] Button (10.4s)
        const t13 = setTimeout(() => {
            setPointer({ show: true, x: 375, y: 520, clicking: false });
            setStepNumber(6);
            setGuideText('6. 우측의 [등록] 버튼을 터치하여 양현재 일지에 기록합니다.');
        }, 10400);

        const t14 = setTimeout(() => {
            setPointer(p => ({ ...p, clicking: true }));
            toast.success('등록되었습니다.');

            // Add to today's log card
            const newLog = {
                id: Date.now(),
                student_id: '1313 이원규',
                category: '졸음',
                detail: '야간 자습 중 졸음 지도',
                time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                teacher: '지도교사'
            };
            setTodayLogs([newLog]);
            setSelectedCategory(null);
            setDetailInput('');
        }, 11100);

        // Step 7: Completed (12.0s)
        const t15 = setTimeout(() => {
            setPointer({ show: false, x: 0, y: 0, clicking: false });
            setStepNumber(7);
            setGuideText('✨ 시연이 완료되었습니다! [오늘 등록 내역]에 생성된 카드를 확인하세요.');
        }, 12000);

        timerRefs.current.push(t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15);
    };

    // Auto run on load
    useEffect(() => {
        const init = setTimeout(() => runDemo(), 400);
        return () => {
            clearTimeout(init);
            clearAllTimers();
        };
    }, []);

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none relative overflow-x-hidden">
            <Toaster position="top-center" />

            {/* TOP FIXED BAR: Controls & Step Guide */}
            <header className="sticky top-0 z-50 bg-slate-900 text-white shadow-md border-b border-slate-800">
                <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => router.push('/teacher/seats')}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-xs font-bold flex items-center gap-1"
                        >
                            <FaArrowLeft />
                            <span className="hidden sm:inline">돌아가기</span>
                        </button>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded">
                                    실제 화면 시연
                                </span>
                                <span className="text-xs font-bold text-white">
                                    양현재 일지 / 시설물 수리
                                </span>
                            </div>
                            <p className="text-[11px] text-amber-300 font-medium truncate max-w-xs sm:max-w-md animate-pulse">
                                {guideText}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            type="button"
                            onClick={runDemo}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1 shadow-sm transition-transform active:scale-95"
                        >
                            <FaRedo className="text-[10px]" />
                            <span>시연 재생</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                clearAllTimers();
                                setPointer({ show: false, x: 0, y: 0, clicking: false });
                                setMode('interactive');
                                setIsModalOpen(true);
                                setGuideText('👉 직접 자유롭게 입력하고 테스트해보세요.');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 transition-colors"
                        >
                            <FaHandPointer className="text-[10px]" />
                            <span>직접 체험</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* MAIN REAL SCREEN: Exactly Matches User's Screenshot #1 */}
            <main className="flex-1 max-w-[430px] w-full mx-auto bg-[#f8f9fa] shadow-2xl min-h-screen flex flex-col border-x border-gray-200">
                {/* Header Section (from Screenshot #1) */}
                <div className="pt-3 px-3 pb-2 bg-[#f8f9fa] flex flex-col gap-2.5">
                    {/* Top Row: | 현황모니터, Center App Icons, Right [좌석 관리] */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-5 bg-amber-400 rounded-full"></div>
                            <span className="font-black text-lg text-slate-800 tracking-tight">현황모니터</span>
                        </div>

                        {/* Center App Icons + Swipe Dots */}
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-1.5">
                                <div className="w-8 h-8 rounded-xl overflow-hidden border border-gray-200 shadow-xs flex items-center justify-center bg-white">
                                    <span className="text-[10px] font-bold text-gray-700">🏢</span>
                                </div>
                                <div className="w-8 h-8 rounded-xl border border-gray-200 shadow-xs flex items-center justify-center bg-white text-slate-700 text-base">
                                    <HiHome />
                                </div>
                                <div className="w-8 h-8 rounded-xl overflow-hidden border border-gray-200 shadow-xs flex items-center justify-center bg-stone-900 text-amber-200 text-[10px] font-bold leading-tight text-center">
                                    호실
                                </div>
                            </div>
                            {/* Swipe Dots Indicator */}
                            <div className="flex items-center gap-1 mt-1 bg-gray-200/80 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                <span className="w-3 h-1.5 rounded-full bg-slate-800"></span>
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                            </div>
                        </div>

                        {/* Right: 좌석 관리 Button */}
                        <button
                            type="button"
                            className="px-2.5 py-1.5 rounded-xl border border-gray-300 bg-white shadow-2xs text-xs font-bold text-slate-700 flex items-center gap-1"
                        >
                            <FaCog className="text-[11px] text-gray-500" />
                            <span>좌석 관리</span>
                        </button>
                    </div>

                    {/* Middle Row: [학생이 없는 경우 TIP] & [학습일지/시설물] */}
                    <div className="flex items-center justify-center gap-2 pt-1">
                        <button
                            type="button"
                            className="h-9 px-4 rounded-full border border-gray-300 bg-white shadow-xs text-xs font-bold text-slate-800 flex items-center gap-1.5"
                        >
                            <span>학생이 없는 경우</span>
                            <span className="font-black text-indigo-600 bg-indigo-50 border border-indigo-200/80 px-1 py-0.2 rounded text-[10px]">
                                TIP
                            </span>
                        </button>

                        <div className="relative">
                            <button
                                type="button"
                                id="demo-guide-btn"
                                onClick={() => setIsModalOpen(true)}
                                className={clsx(
                                    "h-9 px-4 rounded-full border bg-white shadow-xs text-xs font-extrabold text-slate-800 flex items-center justify-center transition-all cursor-pointer",
                                    stepNumber === 1
                                        ? "border-amber-400 ring-4 ring-amber-300/80 scale-105"
                                        : "border-gray-300 hover:bg-gray-50"
                                )}
                            >
                                <span>학습일지/시설물</span>
                            </button>

                            {/* Floating Touch Indicator */}
                            {stepNumber === 1 && (
                                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded shadow-md border border-amber-300 animate-bounce z-20">
                                    👇 터치하세요!
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Third Row: Search Bar (Left) & Room Selector [제1실, 제2실, 제3실] (Right) */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="relative flex-1 h-9">
                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                            <input
                                type="text"
                                readOnly
                                placeholder="학생 자리 검색..."
                                className="w-full h-full pl-8 pr-3 bg-white border border-gray-300 rounded-xl text-xs font-medium text-gray-700 shadow-2xs"
                            />
                        </div>

                        {/* Room Selector Tabs: Exactly as in user screenshot #1 */}
                        <div className="flex items-center bg-gray-200/80 p-0.5 rounded-xl border border-gray-300 shadow-inner h-9 shrink-0">
                            <span className="px-2.5 text-xs font-bold text-gray-600">제1실</span>
                            <span className="px-2.5 text-xs font-bold text-gray-600">제2실</span>
                            <span className="px-3 py-1 text-xs font-black bg-amber-400 text-slate-950 rounded-lg shadow-sm">
                                제3실
                            </span>
                        </div>
                    </div>
                </div>

                {/* Grid Header Numbers (1 2 3 4 across 6 columns) */}
                <div className="border-t border-b border-gray-200 bg-white grid grid-cols-6 text-center text-[10px] font-bold text-gray-400 divide-x divide-gray-200">
                    {[1, 2, 3, 4, 5, 6].map(col => (
                        <div key={col} className="py-0.5 flex justify-around px-0.5">
                            <span>1</span>
                            <span>2</span>
                            <span>3</span>
                            <span>4</span>
                        </div>
                    ))}
                </div>

                {/* EXACT SEAT GRID (Matching Screenshot #1) */}
                <div className="grid grid-cols-6 border-b border-gray-200 bg-white divide-x divide-gray-200">
                    {seatsData.map((item, idx) => {
                        if (item.disabled) {
                            // Dead space / disabled seats (Grey colored block in screenshot)
                            return (
                                <div
                                    key={idx}
                                    className="h-[54px] bg-[#d5dbe1] border-b border-gray-200/80"
                                ></div>
                            );
                        }

                        // Active Seat Card
                        const isBlue = item.color === 'blue';
                        const isRed = item.color === 'red';

                        return (
                            <div
                                key={idx}
                                className={clsx(
                                    "h-[54px] flex flex-col border-b border-gray-200 relative overflow-hidden select-none",
                                    isRed ? "bg-red-600" : isBlue ? "bg-[#d8e6ff]" : "bg-white"
                                )}
                            >
                                {/* Seat Number Top-Right */}
                                <span className={clsx(
                                    "absolute top-0.5 right-1 text-[8px] font-medium leading-none",
                                    isRed ? "text-white/80" : "text-gray-300"
                                )}>
                                    {item.seat}
                                </span>

                                {/* Top Section: Student ID & Name */}
                                <div className="flex-1 flex flex-col justify-center px-1 leading-tight">
                                    <span className={clsx(
                                        "text-[9px] font-medium",
                                        isRed ? "text-white/90" : isBlue ? "text-blue-700 font-bold" : "text-gray-500"
                                    )}>
                                        {item.id}
                                    </span>
                                    <span className={clsx(
                                        "text-[11px] font-bold tracking-tight",
                                        isRed ? "text-white" : isBlue ? "text-blue-900" : "text-gray-900"
                                    )}>
                                        {item.name}
                                    </span>
                                </div>

                                {/* Bottom Section: Period Badges */}
                                <div className={clsx(
                                    "h-4 flex divide-x text-[9px] font-bold text-center",
                                    isRed ? "bg-white" : "bg-gray-50/40 divide-gray-100"
                                )}>
                                    {isRed ? (
                                        <div className="flex-1 flex justify-end items-center pr-1">
                                            <span className="bg-red-600 text-white text-[9px] px-1 rounded font-black">
                                                비
                                            </span>
                                        </div>
                                    ) : (
                                        (item.badges || []).map((b, bIdx) => (
                                            <div
                                                key={bIdx}
                                                className={clsx(
                                                    "flex-1 flex items-center justify-center",
                                                    b === '컴' && "bg-[#b8d4fe] text-blue-800",
                                                    b === '이' && "bg-[#d1d5db] text-gray-700",
                                                    b === '출' && "bg-[#e5e7eb] text-gray-600"
                                                )}
                                            >
                                                {b}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>

            {/* MODAL: 100% Identical to User's Screenshot #2 */}
            {isModalOpen && (
                <div 
                    className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3 animate-in fade-in duration-150"
                    onClick={() => {
                        if (mode === 'interactive') setIsModalOpen(false);
                    }}
                >
                    <div 
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-[420px] overflow-hidden border border-gray-200 relative flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Segment Tab Header: Screenshot #2 */}
                        <div className="p-3 border-b border-gray-100 flex items-center justify-between gap-3">
                            <div className="flex-1 bg-gray-100 p-1 rounded-2xl flex items-center border border-gray-200 shadow-inner">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('yanghyeonjae')}
                                    className={`flex-1 py-1.5 rounded-xl font-black text-sm text-center transition-all ${
                                        activeTab === 'yanghyeonjae'
                                            ? 'bg-white text-gray-900 shadow-xs'
                                            : 'text-gray-500'
                                    }`}
                                >
                                    양현재 일지 등록
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('facility')}
                                    className={`flex-1 py-1.5 rounded-xl font-bold text-sm text-center transition-all ${
                                        activeTab === 'facility'
                                            ? 'bg-white text-gray-900 shadow-xs'
                                            : 'text-gray-500'
                                    }`}
                                >
                                    시설물 수리요청
                                </button>
                            </div>

                            {/* Close ✕ */}
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded-lg text-lg font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-4 space-y-4 text-sm">
                            {/* 1. 학생 선택 */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-bold text-gray-700">학생 선택</span>
                                    <span className="text-xs text-blue-600 font-semibold flex items-center gap-1">
                                        💡 이름을 모를 땐 좌석을 더블터치하세요.
                                    </span>
                                </div>

                                {selectedStudent ? (
                                    <div className="flex items-center justify-between bg-blue-50/80 border border-blue-200 px-3 py-2 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <span className="font-extrabold text-blue-900">{selectedStudent.student_id}</span>
                                            <span className="font-bold text-gray-900">{selectedStudent.name}</span>
                                            <span className="text-xs text-gray-500">
                                                ({selectedStudent.grade}학년 {selectedStudent.class}반)
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedStudent(null);
                                                setStudentSearchInput('');
                                            }}
                                            className="text-xs text-gray-500 hover:text-gray-900 underline font-semibold"
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
                                                    "w-full bg-white border rounded-xl pl-8 pr-3 py-2 text-xs text-gray-800 transition-colors shadow-2xs",
                                                    stepNumber === 2 ? "border-amber-400 ring-2 ring-amber-300" : "border-gray-200"
                                                )}
                                            />
                                        </div>

                                        {/* Dropdown Options */}
                                        {isSearchDropdownOpen && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden divide-y divide-gray-100">
                                                {(filteredStudents.length > 0 ? filteredStudents : candidateStudents).map(st => (
                                                    <button
                                                        key={st.student_id}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedStudent(st);
                                                            setIsSearchDropdownOpen(false);
                                                            setStudentSearchInput('');
                                                        }}
                                                        className={clsx(
                                                            "w-full px-3 py-2 flex items-center justify-between text-left hover:bg-gray-50 text-xs transition-colors",
                                                            st.name === '이원규' && stepNumber === 3 && "bg-amber-100/70 font-bold"
                                                        )}
                                                    >
                                                        <span className="font-bold text-gray-900">
                                                            {st.student_id} {st.name}
                                                        </span>
                                                        <span className="text-gray-400">
                                                            {st.grade}-{st.class}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* 2. 위반 항목: Screenshot #2 (2 rows x 3 columns) */}
                            <div>
                                <span className="block text-xs font-bold text-gray-700 mb-1.5">위반 항목</span>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {['졸음', '전자기기 위반', '무단이석', '지각 입실', '소란', '기타'].map(cat => {
                                        const isSelected = selectedCategory === cat;
                                        return (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => setSelectedCategory(isSelected ? null : cat)}
                                                className={clsx(
                                                    "py-2 rounded-lg border text-xs font-bold transition-all text-center",
                                                    isSelected
                                                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                                                        : "bg-white text-slate-700 hover:bg-gray-50 border-gray-200",
                                                    cat === '졸음' && stepNumber === 4 && "ring-2 ring-amber-400"
                                                )}
                                            >
                                                {cat}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 3. 상세 내용 기입: Screenshot #2 (Badge + Input + Button in one rounded container) */}
                            <div>
                                <span className="block text-xs font-bold text-gray-700 mb-1.5">상세 내용 기입</span>
                                <div className="bg-gray-50/70 border border-gray-200 rounded-xl p-1.5 flex items-center gap-1.5">
                                    {/* Selected Category Tag */}
                                    <div className={clsx(
                                        "px-2.5 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all",
                                        selectedCategory
                                            ? "bg-slate-900 text-white"
                                            : "border border-dashed border-gray-300 text-gray-400 bg-white"
                                    )}>
                                        {selectedCategory || '항목 미선택'}
                                    </div>

                                    {/* Detail Input */}
                                    <input
                                        type="text"
                                        value={detailInput}
                                        onChange={e => setDetailInput(e.target.value)}
                                        placeholder="위반 항목을 위에서 선택하고 상세 내용을 입력하세요"
                                        className={clsx(
                                            "flex-1 bg-white border rounded-lg px-2.5 py-1 text-xs text-gray-800 focus:outline-none transition-colors",
                                            stepNumber === 5 ? "border-amber-400 ring-2 ring-amber-300" : "border-gray-200"
                                        )}
                                    />

                                    {/* Submit Button */}
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
                                                student_id: `${selectedStudent.student_id} ${selectedStudent.name}`,
                                                category: selectedCategory,
                                                detail: detailInput || selectedCategory,
                                                time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                                                teacher: '지도교사'
                                            };
                                            setTodayLogs([newLog]);
                                            setSelectedCategory(null);
                                            setDetailInput('');
                                        }}
                                        className={clsx(
                                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer",
                                            selectedCategory
                                                ? "bg-slate-800 text-white hover:bg-slate-700"
                                                : "bg-[#8f96a3] text-white",
                                            stepNumber === 6 && "ring-4 ring-amber-400"
                                        )}
                                    >
                                        등록
                                    </button>
                                </div>
                            </div>

                            {/* 4. 오늘 등록 내역: Screenshot #2 */}
                            <div className="pt-2 border-t border-gray-100">
                                <span className="block text-xs font-bold text-gray-600 mb-2">
                                    오늘 등록 내역 ({todayLogs.length}건)
                                </span>

                                {todayLogs.length === 0 ? (
                                    <div className="py-6 text-center text-xs text-gray-400">
                                        등록된 내역이 없습니다.
                                    </div>
                                ) : (
                                    <div className="space-y-1.5 animate-in slide-in-from-top-1">
                                        {todayLogs.map(log => (
                                            <div 
                                                key={log.id}
                                                className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between text-xs"
                                            >
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-extrabold text-slate-900">{log.student_id}</span>
                                                        <span className="bg-slate-900 text-white text-[10px] px-1.5 py-0.2 rounded font-bold">
                                                            {log.category}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400">{log.time}</span>
                                                    </div>
                                                    <p className="text-gray-700 font-medium mt-0.5">{log.detail}</p>
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

                        {/* Modal Footer: Screenshot #2 */}
                        <div className="p-3 border-t border-gray-100 bg-white flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => runDemo()}
                                className="text-xs text-blue-600 hover:text-blue-800 font-bold underline flex items-center gap-1 cursor-pointer"
                            >
                                <FaBookOpen className="text-xs" />
                                <span>사용 가이드 보기</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-1.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* VIRTUAL TOUCH POINTER & PING ANIMATION */}
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
                            <span className="absolute -top-3 -left-3 w-12 h-12 bg-amber-400 rounded-full animate-ping opacity-75"></span>
                        )}
                        <div className={clsx(
                            "w-9 h-9 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-2xl border-2 border-white transition-transform",
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
