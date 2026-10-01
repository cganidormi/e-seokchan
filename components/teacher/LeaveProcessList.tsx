'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { IoSearch } from 'react-icons/io5';
import { LeaveRequest } from './types';
import { LeaveProcessCard } from './LeaveProcessCard';
import { MorningCheckoutModal } from '@/components/room/MorningCheckoutModal';
import SwipeNudgeDots from './SwipeNudgeDots';

interface LeaveProcessListProps {
    leaveRequests: LeaveRequest[];
    onUpdateStatus: (requestId: string | number, newStatus: string) => void;
    onCancel: (requestId: string | number) => void;
    teacherName: string;
    teacherId: string;
    teacherPosition?: string;
    unifiedViewMode: 'my_active' | 'all_active' | 'past_all' | 'search_name';
    onTabChange: (mode: 'my_active' | 'all_active' | 'past_all' | 'search_name') => void;
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
}) => {
    const router = useRouter();
    const [filterType, setFilterType] = useState('전체'); // Added filter type state
    const [searchQuery, setSearchQuery] = useState(''); // Added student name search state
    const [expandedId, setExpandedId] = useState<string | number | null>(null);
    const [statusMenuId, setStatusMenuId] = useState<string | number | null>(null);

    const [now, setNow] = useState(new Date());
    const [isMorningModalOpen, setIsMorningModalOpen] = useState(false);

    const leaveTypes = ['컴이석', '이석', '외출', '외박', '자리비움']; // Define leave types

    React.useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(timer);
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
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-[#FF6F61] rounded-full"></div>
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-xl font-extrabold text-gray-800">이석 처리 ({teacherName} 감독선생님)</h1>
                    </div>
                </div>
            </div>

            {/* Pagination Dots (스와이프 넛지) - 1번 화면용 */}
            <div className="flex justify-center w-full mb-4">
                <SwipeNudgeDots currentIndex={0} className="bg-gray-200/60 py-1.5 px-4 rounded-full shadow-inner" />
            </div>

            {/* Seat Map Button */}
            <button
                onClick={() => router.push('/teacher/seats')}
                className="w-full mb-2 py-3 rounded-xl text-sm font-medium transition-all text-white shadow-sm text-right pr-6 bg-cover bg-no-repeat cursor-pointer active:scale-[0.99]"
                style={{
                    backgroundImage: `linear-gradient(to right, rgba(255, 111, 97, 0) 30%, rgba(255, 111, 97, 1) 100%), url('/study_room.png')`,
                    backgroundPosition: 'center 70%'
                }}
            >
                학습감독 자리배치도 →
            </button>

            {/* Headcount Mapping Button */}
            <button
                onClick={() => router.push('/teacher/headcount')}
                className="w-full mb-2 py-3 rounded-xl text-sm font-medium transition-all text-indigo-100 shadow-lg text-right pr-6 bg-cover bg-no-repeat cursor-pointer active:scale-[0.99]"
                style={{
                    backgroundImage: `linear-gradient(to right, rgba(79, 70, 229, 0) 30%, rgba(79, 70, 229, 1) 100%), url('/kshs_building.png')`,
                    backgroundPosition: 'center 15%'
                }}
            >
                취침지도 호실배치도 →
            </button>

            {/* Morning Checkout Button */}
            <button
                onClick={() => setIsMorningModalOpen(true)}
                className="w-full mb-6 py-3 rounded-xl text-sm font-medium transition-all text-white shadow-lg text-right pr-6 bg-no-repeat bg-[#2d2d2d] hover:bg-[#3d3d3d]"
                style={{
                    backgroundImage: `url('/yellow_card.svg')`,
                    backgroundPosition: '10px center',
                    backgroundSize: '40px 40px'
                }}
            >
                생활규정 미준수지도 →
            </button>

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
                                    ? "bg-[#FF6F61] text-white shadow-sm font-extrabold"
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
                            className="w-full pl-10 pr-9 py-2.5 text-[16px] sm:text-sm bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#FF6F61] focus:ring-1 focus:ring-[#FF6F61] shadow-inner transition-all"
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
                                    ? "bg-[#FF6F61] text-white border-[#FF6F61] shadow-sm"
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
                        className="relative overflow-hidden p-8 sm:p-10 rounded-[2rem] border border-white/20 shadow-xl text-center flex flex-col items-center justify-center min-h-[140px] bg-cover bg-no-repeat transition-all"
                        style={{
                            backgroundImage: `linear-gradient(to right, rgba(255, 111, 97, 0.35), rgba(255, 111, 97, 0.45)), url('/images/starry_crescent_coral.jpg')`,
                            backgroundPosition: 'right 12%',
                            backgroundSize: 'cover'
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
        </div>
    );
};
