'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { LeaveRequest } from './types';
import { LeaveStatusCard } from './LeaveStatusCard';
import { supabase } from '@/supabaseClient';

interface LeaveStatusListProps {
    leaveRequests: LeaveRequest[];
    onCancel: (id: number) => void;
    leaveTypes: string[];
}

export const LeaveStatusList: React.FC<LeaveStatusListProps> = ({
    leaveRequests,
    onCancel,
    leaveTypes
}) => {
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [viewMode, setViewMode] = useState<'active' | 'past'>('active');
    const [filterType, setFilterType] = useState('전체');
    const [now, setNow] = useState(new Date());
    const [specialHolidays, setSpecialHolidays] = useState<string[]>([]);

    React.useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 30000);

        const fetchHolidays = async () => {
            const { data } = await supabase.from('special_holidays').select('date');
            if (data) setSpecialHolidays(data.map((h: { date: string }) => h.date));
        };
        fetchHolidays();

        return () => clearInterval(timer);
    }, []);

    const isDateHoliday = (date: Date) => {
        const day = date.getDay();
        const isWeekend = day === 0 || day === 6;
        if (isWeekend) return true;
        const dateStr = date.toLocaleDateString('en-CA');
        return specialHolidays.includes(dateStr);
    };

    const isRequestActive = (req: any) => {
        if (req.status === '취소' || req.status === '반려') return false;
        const endTime = new Date(req.end_time);

        // If it's already significantly past the end time, it's definitely past
        if (endTime < now) return false;

        // Special handling for "end of day" legacy timestamps (e.g., 23:59) 
        // that might keep daytime sessions active too long.
        // If the end time is essentially midnight and it contains Daytime (주간),
        // we should expire it earlier (e.g., after 19:00).
        if (endTime.getHours() >= 23 && req.period) {
            const isDaytime = req.period.includes('주간') || req.period.includes('오전') || req.period.includes('오후');
            const isHoliday = isDateHoliday(now);

            if (isDaytime && !isHoliday && now.getHours() >= 19) return false;
            if (isDaytime && isHoliday && now.getHours() >= 18) return false;
        }

        return true;
    };

    const activeRequests = leaveRequests.filter(req => isRequestActive(req));
    const pastRequests = leaveRequests.filter(req => !isRequestActive(req));
    const displayList = (viewMode === 'active' ? activeRequests : pastRequests)
        .filter(req => filterType === '전체' || req.leave_type === filterType);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-6 bg-yellow-400 rounded-full"></div>
                <h2 className="text-xl font-extrabold text-gray-800">이석현황</h2>
            </div>

            <div className="flex flex-col gap-3 pb-24">
                {/* 탭 전환 UI */}
                <div className="flex bg-[#1a1a1a] rounded-xl p-1 gap-1 w-fit mb-2">
                    <button
                        onClick={() => setViewMode('active')}
                        className={clsx(
                            "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                            viewMode === 'active' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                        )}
                    >
                        진행 중
                    </button>
                    <button
                        onClick={() => setViewMode('past')}
                        className={clsx(
                            "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                            viewMode === 'past' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                        )}
                    >
                        지난 내역
                    </button>
                </div>

                {/* 이석 종류 필터 */}
                <div className="flex gap-2 pb-2 overflow-x-auto no-scrollbar">
                    {['전체', ...leaveTypes].map((type) => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={clsx(
                                "px-3 py-1 rounded-full text-[11px] font-bold transition-all whitespace-nowrap border",
                                filterType === type
                                    ? "bg-amber-400 text-black border-amber-400"
                                    : "bg-transparent text-gray-500 border-white/10 hover:border-white/20"
                            )}
                        >
                            {type}
                        </button>
                    ))}
                </div>

                {displayList.length === 0 ? (
                    <div className="bg-[#1a1a1a] p-10 rounded-[2rem] border border-dashed border-white/10 text-center text-gray-600 text-xs italic">
                        {filterType === '전체'
                            ? (viewMode === 'active' ? '진행 중인 이석 내역이 없습니다.' : '지난 이석 내역이 없습니다.')
                            : `${viewMode === 'active' ? '진행 중인' : '지난'} '${filterType}' 내역이 없습니다.`
                        }
                    </div>
                ) : (
                    displayList.map((req) => (
                        <LeaveStatusCard
                            key={req.id}
                            req={req}
                            isExpanded={expandedId === req.id}
                            onToggleExpand={() => setExpandedId(expandedId === req.id ? null : req.id)}
                            onCancel={onCancel}
                            viewMode={viewMode}
                        />
                    ))
                )}
            </div>
        </div>
    );
};
