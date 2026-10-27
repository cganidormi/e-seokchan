'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { IoSearch } from 'react-icons/io5';
import { LeaveRequest } from './types';
import { LeaveProcessCard } from './LeaveProcessCard';
import { MorningCheckoutModal } from '@/components/room/MorningCheckoutModal';
import SwipeNudgeDots from './SwipeNudgeDots';
import { DaySupervision } from '@/lib/supervisionParser';
import { TodaySupervisionModal } from './TodaySupervisionModal';

interface LeaveProcessListProps {
    leaveRequests: LeaveRequest[];
    onUpdateStatus: (requestId: string | number, newStatus: string) => void;
    onCancel: (requestId: string | number) => void;
    teacherName: string;
    teacherId: string;
    teacherPosition?: string;
    unifiedViewMode: 'my_active' | 'all_active' | 'past_all' | 'search_name';
    onTabChange: (mode: 'my_active' | 'all_active' | 'past_all' | 'search_name') => void;
    isSangchanAdmin?: boolean;
    unreadDongheonChatCount?: number;
    onOpenDongheonChat?: () => void;
}

export const LeaveProcessList: React.FC<LeaveProcessListProps> = ({
    leaveRequests,
    onUpdateStatus,
    onCancel,
    teacherName,
    teacherId,
    teacherPosition,
    unifiedViewMode,
    onTabChange,
    isSangchanAdmin,
    unreadDongheonChatCount = 0,
    onOpenDongheonChat,
}) => {
    const router = useRouter();
    const [filterType, setFilterType] = useState('전체'); // Added filter type state
    const [searchQuery, setSearchQuery] = useState(''); // Added student name search state
    const [expandedId, setExpandedId] = useState<string | number | null>(null);
    const [statusMenuId, setStatusMenuId] = useState<string | number | null>(null);

    const [now, setNow] = useState(new Date());
    const [isMorningModalOpen, setIsMorningModalOpen] = useState(false);
    const [todayDayData, setTodayDayData] = useState<DaySupervision | null>(null);
    const [todayYear, setTodayYear] = useState<number>(new Date().getFullYear());
    const [todayMonth, setTodayMonth] = useState<number>(new Date().getMonth() + 1);
    const [isTodaySupervisionModalOpen, setIsTodaySupervisionModalOpen] = useState(false);

    // 오늘 로그인한 선생님의 근무 여부 계산
    const hasMyDutyToday = React.useMemo(() => {
        if (!todayDayData || !teacherName) return false;
        const cleanName = teacherName.trim();
        const check = (val?: string) => Boolean(val && val.replace(/^#/, '').trim().includes(cleanName));

        // 평일 감독
        const weekdayMatch = Boolean(
            check(todayDayData.weekday?.room1?.afterSchool) ||
            check(todayDayData.weekday?.room1?.night1) ||
            check(todayDayData.weekday?.room1?.night2) ||
            check(todayDayData.weekday?.room2?.afterSchool) ||
            check(todayDayData.weekday?.room2?.night1) ||
            check(todayDayData.weekday?.room2?.night2) ||
            check(todayDayData.weekday?.room3?.afterSchool) ||
            check(todayDayData.weekday?.room3?.night1) ||
            check(todayDayData.weekday?.room3?.night2)
        );

        // 주말 / 휴일 감독
        const weekendMatch = Boolean(
            check(todayDayData.weekend?.room1?.morning) ||
            check(todayDayData.weekend?.room1?.afternoon) ||
            check(todayDayData.weekend?.room1?.night) ||
            check(todayDayData.weekend?.room1?.nightCare) ||
            check(todayDayData.weekend?.room2?.dayCare) ||
            check(todayDayData.weekend?.room2?.nightCare) ||
            check(todayDayData.weekend?.room3?.dayCare) ||
            check(todayDayData.weekend?.room3?.nightCare)
        );

        // 귀교 지도
        const returnGuideMatch = check(todayDayData.returnGuide);

        return weekdayMatch || weekendMatch || returnGuideMatch;
    }, [todayDayData, teacherName]);

    const leaveTypes = ['컴이석', '이석', '외출', '외박', '자리비움']; // Define leave types

    React.useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(timer);
    }, []);

    // 금일 감독 배정 데이터 조회
    React.useEffect(() => {
        const fetchTodayDuty = async () => {
            try {
                const res = await fetch('/api/teacher/supervision-schedule');
                if (!res.ok) return;
                const data = await res.json();
                if (!data.schedule?.months) return;

                const todayObj = new Date();
                const currentMonth = todayObj.getMonth() + 1;
                const currentDay = todayObj.getDate();

                if (data.schedule.year) {
                    setTodayYear(data.schedule.year);
                }
                setTodayMonth(currentMonth);

                const monthData = data.schedule.months[currentMonth];
                if (!monthData?.days) return;

                const dayData = monthData.days.find((d: any) => d.day === currentDay);
                if (dayData) {
                    setTodayDayData(dayData);
                }
            } catch (e) {
                console.error('Failed to load today duty:', e);
            }
        };

        fetchTodayDuty();
    }, []);

    // Close status menu when clicking outside
    React.useEffect(() => {
        if (statusMenuId === null) return;

        const handleGlobalClick = () => {
            setStatusMenuId(null);
        };

        // Use a small timeout to avoid immediate closure from the click that opened it
        const timeoutId = setTimeout(() => {
            window.addEventListener('click', handleGlobalClick);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('click', handleGlobalClick);
        };
    }, [statusMenuId]);

    // ... (rest of logic unchanged)

    const isRequestActive = (req: any) => {
        if (req.status === '취소' || req.status === '반려' || req.status === '복귀') return false;
        const endTime = new Date(req.end_time);
        if (endTime < now) return false;
        return true;
    };

    const filtered = (leaveRequests || []).filter(req => {
        // 1. Leave Type Filter
        if (filterType !== '전체' && req.leave_type !== filterType) return false;

        // 2. Student Name / ID Search Filter
        if (unifiedViewMode === 'search_name') {
            const q = searchQuery.trim().toLowerCase();
            if (!q) return false;

            const mainStudentId = (req.student_id || '').toLowerCase();
            const matchingSubStudent = req.leave_request_students?.some(s => (s.student_id || '').toLowerCase().includes(q));

            if (!mainStudentId.includes(q) && !matchingSubStudent) {
                return false;
            }
        }

        return true;
    }).sort((a, b) => {
        const timeA = new Date(a.start_time).getTime();
        const timeB = new Date(b.start_time).getTime();
        // 'past_all' or 'search_name' -> Descending (Recent first)
        // Others -> Ascending (Imminent first)
        return (unifiedViewMode === 'past_all' || unifiedViewMode === 'search_name') ? timeB - timeA : timeA - timeB;
    });

    return (
        <div className="flex flex-col w-full max-w-xl mx-auto relative">
            <div className="flex items-center justify-between gap-2.5 mb-4">
                <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="w-[3.5px] h-5 bg-gray-800 rounded-full shrink-0"></div>
                    <h1 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">
                        {teacherName} 감독선생님
                    </h1>
                    <button
                        type="button"
                        onClick={() => setIsTodaySupervisionModalOpen(true)}
                        className={clsx(
                            "px-2.5 py-1 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer active:scale-95 border",
                            hasMyDutyToday
                                ? "bg-white hover:bg-gray-50 text-gray-900 border-gray-300"
                                : "bg-gray-50 hover:bg-gray-100 text-gray-400 border-gray-200"
                        )}
                        title="오늘 감독 배정표 확인"
                    >
                        {hasMyDutyToday ? `${new Date().getDate()}일 감독` : '감독 없음'}
                    </button>
                </div>
            </div>

            {/* Pagination Dots (스와이프 넛지) - 1번 화면용 */}
            <div className="flex justify-center w-full mb-4">
                <SwipeNudgeDots currentIndex={0} className="bg-gray-200/60 py-1.5 px-4 rounded-full shadow-inner" />
            </div>

            {/* Seat Map Button */}
            <button
                onClick={() => router.push('/teacher/seats', { scroll: false })}
                className="w-full mb-3.5 py-3 rounded-xl text-sm font-bold transition-all text-white shadow-sm text-right pr-6 bg-cover bg-no-repeat cursor-pointer active:scale-[0.99]"
                style={{
                    backgroundImage: `linear-gradient(to right, rgba(250, 204, 21, 0) 55%, rgba(250, 204, 21, 0.6) 100%), url('/study_room.png')`,
                    backgroundPosition: 'center 70%'
                }}
            >
                학습감독 자리배치도 →
            </button>

            {/* Headcount Mapping Button */}
            <button
                onClick={() => router.push('/teacher/headcount', { scroll: false })}
                className="w-full mb-3.5 py-3 rounded-xl text-sm font-bold transition-all text-white shadow-lg text-right pr-6 bg-cover bg-no-repeat cursor-pointer active:scale-[0.99]"
                style={{
                    backgroundImage: `linear-gradient(to right, rgba(79, 70, 229, 0) 55%, rgba(79, 70, 229, 0.6) 100%), url('/kshs_building.png')`,
                    backgroundPosition: 'center 15%'
                }}
            >
                취침지도 호실배치도 →
            </button>

            {/* Quick Link Buttons (Supervision, Admin & Today Hongjigwan) */}
            <div className="flex justify-end items-center gap-2 mb-6">
                {/* Admin Page Button (관리자 권한을 가진 교사에게만 노출) */}
                {teacherPosition === '관리자' && (
                    <button
                        onClick={() => router.push('/admin/students')}
                        className="h-11 px-5 rounded-full text-sm font-bold transition-all bg-[#111827] hover:bg-black text-white border border-gray-700/60 shadow-sm cursor-pointer active:scale-[0.98] flex items-center justify-center"
                    >
                        <span>관리자</span>
                    </button>
                )}

                {/* Supervision Schedule Button (모든 교사에게 노출) */}
                <button
                    onClick={() => router.push('/teacher/supervision')}
                    className="h-11 px-4 rounded-full text-sm font-bold transition-all bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 shadow-sm cursor-pointer active:scale-[0.98] flex items-center gap-2"
                    style={{ backgroundColor: '#ffffff' }}
                    title="양현재 학습실 감독표"
                >
                    <img 
                        src="/apple_calendar.png" 
                        alt="감독표 달력" 
                        className="w-5 h-5 object-contain flex-shrink-0" 
                    />
                    <span>감독표</span>
                </button>

                {/* Today Dashboard Button */}
                <button
                    onClick={() => router.push('/today')}
                    className="h-11 pl-[5.5px] pr-4 rounded-full text-sm font-bold transition-all bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 shadow-sm cursor-pointer active:scale-[0.98] flex items-center gap-2"
                >
                    <div className="p-[1.5px] rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 flex-shrink-0 shadow-xs">
                        <div className="p-[1px] bg-white rounded-full">
                            <img src="/dorm.jpg" alt="Icon" className="w-7 h-7 rounded-full object-cover" />
                        </div>
                    </div>
                    <span>오늘의 홍지관 →</span>
                </button>
            </div>

            {/* 탭 전환 UI */}
            <div className="flex flex-col gap-3 mb-4">
                {/* 4-Tab UI */}
                <div className="flex p-1 bg-[#1a1a1a] rounded-xl w-full gap-0.5">
                    {[
                        { id: 'my_active', label: '내 담당' },
                        { id: 'all_active', label: '전체 현황' },
                        { id: 'past_all', label: '지난 내역' },
                        { id: 'search_name', label: '학생 검색' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id as any)}
                            className={clsx(
                                "flex-1 py-2 rounded-lg text-xs font-bold transition-all text-center whitespace-nowrap flex items-center justify-center gap-1 cursor-pointer",
                                unifiedViewMode === tab.id
                                    ? "bg-[#0E8694] text-white shadow-sm font-extrabold"
                                    : tab.id === 'search_name'
                                        ? "text-white hover:text-gray-200 font-extrabold"
                                        : "text-gray-500 hover:text-gray-300"
                            )}
                        >
                            {tab.id === 'search_name' && <IoSearch className="w-3.5 h-3.5 shrink-0 text-white" />}
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* 이름 검색 입력창 (이름검색 탭 선택 시 노출) */}
                {unifiedViewMode === 'search_name' && (
                    <div className="relative w-full">
                        <IoSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="학생 이름 또는 학번 입력..."
                            enterKeyHint="search"
                            autoComplete="off"
                            className="w-full pl-10 pr-9 py-2.5 text-[16px] sm:text-sm bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#0E8694] focus:ring-1 focus:ring-[#0E8694] shadow-inner transition-all"
                            style={{ fontSize: '16px' }}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs font-bold"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                )}

                {/* 이석 종류 필터 (가로 스크롤) */}
                <div className="flex gap-2 justify-center overflow-x-auto no-scrollbar">
                    {['전체', ...leaveTypes].map((type) => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={clsx(
                                "px-3 py-1.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap border cursor-pointer",
                                filterType === type
                                    ? "bg-[#0E8694] text-white border-[#0E8694] shadow-sm"
                                    : "bg-transparent text-gray-500 border-white/10 hover:border-white/20"
                            )}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-3 pb-24">
                {filtered.length === 0 ? (
                    <div
                        className="relative overflow-hidden p-8 sm:p-10 rounded-[2rem] border border-white/30 shadow-md text-center flex flex-col items-center justify-center min-h-[140px] bg-[#0E8694] bg-cover bg-no-repeat transition-all"
                        style={{
                            backgroundImage: `linear-gradient(to right, rgba(14, 134, 148, 0.4), rgba(6, 182, 212, 0.4)), url('/images/almond_blossom.jpg')`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center 40%'
                        }}
                    >
                        <div className="relative z-10 flex flex-col items-center justify-center gap-1.5">
                            <p className="text-white text-sm sm:text-base font-medium tracking-normal drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] select-none">
                                {unifiedViewMode === 'my_active' && '처리할 내 담당 이석 내역이 없습니다.'}
                                {unifiedViewMode === 'all_active' && '현재 처리할 이석 내역이 없습니다.'}
                                {unifiedViewMode === 'past_all' && '지난 내역이 없습니다.'}
                                {unifiedViewMode === 'search_name' && (
                                    !searchQuery.trim()
                                        ? '💡 상단 검색창에 학생의 이름이나 학번을 입력해 주세요.'
                                        : `'${searchQuery}' 검색 결과가 없습니다.`
                                )}
                            </p>
                            {filterType !== '전체' && (
                                <p className="text-xs text-white/90 font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                                    ('{filterType}' 필터 적용됨)
                                </p>
                            )}
                        </div>
                    </div>
                ) : (
                    filtered.map((req) => (
                        <LeaveProcessCard
                            key={req.id}
                            req={req}
                            isExpanded={expandedId === req.id}
                            onToggleExpand={() => setExpandedId(expandedId === req.id ? null : req.id)}
                            isMenuOpen={statusMenuId === req.id}
                            onToggleMenu={(e) => {
                                e.stopPropagation();
                                setStatusMenuId(statusMenuId === req.id ? null : req.id);
                            }}
                            onUpdateStatus={(id, status) => {
                                onUpdateStatus(id, status);
                                setStatusMenuId(null);
                            }}
                            onCancel={onCancel}
                            viewMode={unifiedViewMode === 'past_all' ? 'past' : 'active'}
                            currentTeacherId={teacherId}
                            teacherPosition={teacherPosition}
                        />
                    ))
                )}
            </div>


            <MorningCheckoutModal
                isOpen={isMorningModalOpen}
                onClose={() => setIsMorningModalOpen(false)}
            />

            <TodaySupervisionModal
                isOpen={isTodaySupervisionModalOpen}
                onClose={() => setIsTodaySupervisionModalOpen(false)}
                dayData={todayDayData}
                year={todayYear}
                month={todayMonth}
                myTeacherName={teacherName}
            />
        </div>
    );
};
