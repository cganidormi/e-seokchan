'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { LeaveRequest } from './types';
import { LeaveProcessCard } from './LeaveProcessCard';
import { MorningCheckoutModal } from '@/components/room/MorningCheckoutModal';

interface LeaveProcessListProps {
    leaveRequests: LeaveRequest[];
    onUpdateStatus: (requestId: string | number, newStatus: string) => void;
    onCancel: (requestId: string | number) => void;
    teacherName: string;
    teacherId: string;
}

export const LeaveProcessList: React.FC<LeaveProcessListProps> = ({
    leaveRequests,
    onUpdateStatus,
    onCancel,
    teacherName,
    teacherId,
}) => {
    // Unified View Mode: 'my_active' | 'all_active' | 'past_all'
    const [unifiedViewMode, setUnifiedViewMode] = useState<'my_active' | 'all_active' | 'past_all'>('my_active');
    const [filterType, setFilterType] = useState('전체'); // Added filter type state
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
        // 시간대에 따른 숨김 로직 제거 (주말 및 야간에도 신청 내역 항상 노출)
        // if (endTime.getHours() >= 23 && req.period) {
        //     const isDaytime = req.period.includes('주간') || req.period.includes('오전') || req.period.includes('오후');
        //     const isWeekend = now.getDay() === 0 || now.getDay() === 6;
        //     if (isDaytime && !isWeekend && now.getHours() >= 19) return false;
        //     if (isDaytime && isWeekend && now.getHours() >= 18) return false;
        // }
        return true;
    };

    const filtered = (leaveRequests || []).filter(req => {
        // 1. Unified Filter
        const isActive = isRequestActive(req);

        if (unifiedViewMode === 'past_all') {
            // "지난 내역": Show inactive items (past/cancelled). No user restriction (show all).
            if (isActive) return false;
        } else {
            // "내 담당", "전체 현황": Show ACTIVE items only.
            if (!isActive) return false;

            if (unifiedViewMode === 'my_active') {
                // "내 담당": Filter by my ID
                if (req.teacher_id !== teacherId) return false;
            }
            // "전체 현황": No user restriction.
        }

        // 2. Leave Type Filter
        if (filterType !== '전체' && req.leave_type !== filterType) return false;

        return true;
    }).sort((a, b) => {
        const timeA = new Date(a.start_time).getTime();
        const timeB = new Date(b.start_time).getTime();
        // 'past_all' -> Descending (Recent first)
        // Others -> Ascending (Imminent first)
        return unifiedViewMode === 'past_all' ? timeB - timeA : timeA - timeB;
    });

    return (
        <div className="flex flex-col w-full max-w-xl mx-auto relative">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-yellow-400 rounded-full"></div>
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-xl font-extrabold text-gray-800">이석 처리 ({teacherName} 감독선생님)</h1>
                    </div>
                </div>
            </div>

            {/* Seat Map Button */}
            <button
                onClick={() => window.location.href = '/teacher/seats'}
                className="w-full mb-2 py-3 rounded-xl text-sm font-bold transition-all text-white shadow-sm text-right pr-6 bg-cover bg-no-repeat"
                style={{
                    backgroundImage: `linear-gradient(to right, rgba(250, 204, 21, 0) 30%, rgba(250, 204, 21, 1) 100%), url('/study_room.png')`,
                    backgroundPosition: 'center 70%'
                }}
            >
                학습감독 자리배치도 →
            </button>

            {/* Headcount Mapping Button */}
            <button
                onClick={() => window.location.href = '/teacher/headcount'}
                className="w-full mb-2 py-3 rounded-xl text-sm font-bold transition-all text-indigo-100 shadow-lg text-right pr-6 bg-cover bg-no-repeat"
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
                className="w-full mb-6 py-3 rounded-xl text-sm font-bold transition-all text-white shadow-lg text-right pr-6 bg-no-repeat bg-[#2d2d2d] hover:bg-[#3d3d3d]"
                style={{
                    backgroundImage: `url('/yellow_card.svg')`,
                    backgroundPosition: '10px center',
                    backgroundSize: '40px 40px'
                }}
            >
                일과시간 미준수지도 →
            </button>

            {/* 탭 전환 UI */}
            <div className="flex flex-col gap-3 mb-4">
                {/* 3-Tab UI */}
                <div className="flex p-1 bg-[#1a1a1a] rounded-xl w-full">
                    {[
                        { id: 'my_active', label: '내 담당' },
                        { id: 'all_active', label: '전체 현황' },
                        { id: 'past_all', label: '지난 내역' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setUnifiedViewMode(tab.id as any)}
                            className={clsx(
                                "flex-1 py-2 rounded-lg text-xs font-bold transition-all text-center",
                                unifiedViewMode === tab.id
                                    ? "bg-blue-600 text-white shadow-sm"
                                    : "text-gray-500 hover:text-gray-300"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* 이석 종류 필터 (가로 스크롤) */}
                <div className="flex gap-2 justify-center overflow-x-auto no-scrollbar">
                    {['전체', ...leaveTypes].map((type) => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={clsx(
                                "px-3 py-1.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap border",
                                filterType === type
                                    ? "bg-amber-400 text-black border-amber-400"
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
                    <div className="bg-[#1a1a1a] p-10 rounded-[2rem] border border-dashed border-white/10 text-center text-gray-600 text-xs italic">
                        {unifiedViewMode === 'my_active' && '처리할 내 담당 이석 내역이 없습니다.'}
                        {unifiedViewMode === 'all_active' && '현재 처리할 이석 내역이 없습니다.'}
                        {unifiedViewMode === 'past_all' && '지난 내역이 없습니다.'}
                        {filterType !== '전체' && <p>('{filterType}' 필터 적용됨)</p>}
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
