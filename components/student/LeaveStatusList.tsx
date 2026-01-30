'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { LeaveRequest, Student } from './types';
import { LeaveStatusCard } from './LeaveStatusCard';
import { supabase } from '@/supabaseClient';
import toast from 'react-hot-toast';

interface LeaveStatusListProps {
    leaveRequests: LeaveRequest[];
    onCancel: (id: number) => void;
    onCopy: (req: LeaveRequest) => void;
    leaveTypes: string[];
    students: Student[];
    studentId: string;
}

export const LeaveStatusList: React.FC<LeaveStatusListProps> = ({
    leaveRequests,
    onCancel,
    onCopy,
    leaveTypes,
    students,
    studentId
}) => {
    // Unified View Mode: 'my_active' | 'all_active' | 'past_all'
    const [unifiedViewMode, setUnifiedViewMode] = useState<'my_active' | 'all_active' | 'past_all'>('my_active');
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [filterType, setFilterType] = useState('전체');
    const [now, setNow] = useState(new Date());
    const [specialHolidays, setSpecialHolidays] = useState<string[]>([]);
    const [timetable, setTimetable] = useState<any[]>([]);

    React.useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 30000);

        const fetchHolidays = async () => {
            const { data } = await supabase.from('special_holidays').select('date');
            if (data) setSpecialHolidays(data.map((h: { date: string }) => h.date));
        };

        const fetchTimetable = async () => {
            const { data } = await supabase.from('timetable_entries').select('*');
            if (data) setTimetable(data);
        };

        fetchHolidays();
        fetchTimetable();

        return () => clearInterval(timer);
    }, []);

    const isDateHoliday = (date: Date) => {
        const day = date.getDay();
        const isWeekend = day === 0 || day === 6;
        if (isWeekend) return true;
        const dateStr = date.toLocaleDateString('en-CA');
        return specialHolidays.includes(dateStr);
    };

    const getDynamicEndTime = (req: any) => {
        if (req.status === '취소' || req.status === '반려' || req.status === '복귀') return null;

        if (!timetable || timetable.length === 0 || !req.period) {
            return new Date(req.end_time);
        }

        const requestDate = new Date(req.start_time);
        const isWeekendOrHoliday = isDateHoliday(requestDate);
        const dayPrefix = isWeekendOrHoliday ? '주말' : '평일';

        let type = '';
        if (req.period.includes('주간') || req.period.includes('오전') || req.period.includes('오후')) type = '주간';
        else if (req.period.includes('야간')) type = '야간';

        const matches = req.period.match(/(\d+)/g);

        if (!type || !matches || matches.length === 0) {
            return new Date(req.end_time);
        }

        const numbers = matches.map(Number);
        const lastPeriodNumber = Math.max(...numbers);

        const targetDescription = `${dayPrefix}${type}${lastPeriodNumber}교시`;
        const entry = timetable.find((t: any) => t.description === targetDescription);

        if (entry) {
            const [hours, minutes, seconds] = entry.end_time.split(':').map(Number);
            const dynamicEnd = new Date(requestDate);
            dynamicEnd.setHours(hours, minutes, seconds || 0, 0);
            return dynamicEnd;
        }

        return new Date(req.end_time);
    };

    const isRequestActive = (req: any) => {
        if (req.status === '취소' || req.status === '반려' || req.status === '복귀') return false;

        const endTime = getDynamicEndTime(req);
        if (!endTime) return false;
        if (endTime < now) return false;

        if (endTime.getHours() >= 23 && req.period) {
            const isDaytime = req.period.includes('주간') || req.period.includes('오전') || req.period.includes('오후');
            const isHoliday = isDateHoliday(now);
            if (timetable.length > 0) return true;
            if (isDaytime && !isHoliday && now.getHours() >= 19) return false;
            if (isDaytime && isHoliday && now.getHours() >= 18) return false;
        }
        return true;
    };

    const displayList = (leaveRequests || []).filter(req => {
        // 1. Filter by Unified Mode
        const isActive = isRequestActive(req);

        if (unifiedViewMode === 'past_all') {
            // "지난 내역": Show inactive items (past/cancelled). No user restriction (show all).
            if (isActive) return false;
        } else {
            // "내 이석", "전체 현황": Show ACTIVE items only.
            if (!isActive) return false;

            if (unifiedViewMode === 'my_active') {
                // "내 이석": Filter by my ID
                const isMain = req.student_id === studentId;
                const isCo = req.leave_request_students?.some((s: { student_id: string }) => s.student_id === studentId);
                if (!isMain && !isCo) return false;
            }
            // "전체 현황": No user restriction.
        }

        // 2. Filter by Type
        if (filterType !== '전체' && req.leave_type !== filterType) return false;

        return true;
    });

    return (
        <div className="flex flex-col gap-4 w-full max-w-xl mx-auto">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-6 bg-yellow-400 rounded-full"></div>
                <h2 className="text-xl font-extrabold text-gray-800">이석현황</h2>
            </div>

            <div className="flex flex-col gap-3 pb-24">
                {/* 학습감독 자리배치도 버튼 */}
                <button
                    onClick={() => window.location.href = '/student/seats'}
                    className="w-full mb-1 py-3 rounded-xl text-sm font-bold transition-all text-black shadow-sm text-left pl-6 bg-cover bg-no-repeat"
                    style={{
                        backgroundImage: `linear-gradient(to right, rgba(250, 204, 21, 1) 30%, rgba(250, 204, 21, 0) 100%), url('/study_room.png')`,
                        backgroundPosition: 'center 70%'
                    }}
                >
                    양현재 자리배치도 →
                </button>

                {/* 3-Tab UI */}
                <div className="flex p-1 bg-[#1a1a1a] rounded-xl w-full">
                    {[
                        { id: 'my_active', label: '내 이석' },
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

                {displayList.length === 0 ? (
                    <div className="bg-[#1a1a1a] p-10 rounded-[2rem] border border-dashed border-white/10 text-center text-gray-600 text-xs italic">
                        {unifiedViewMode === 'my_active' && '진행 중인 내 이석이 없습니다.'}
                        {unifiedViewMode === 'all_active' && '현재 진행 중인 이석이 없습니다.'}
                        {unifiedViewMode === 'past_all' && '지난 이석 내역이 없습니다.'}
                        {filterType !== '전체' && <p>('{filterType}' 필터 적용됨)</p>}
                    </div>
                ) : (
                    displayList.map((req) => (
                        <LeaveStatusCard
                            key={req.id}
                            req={req}
                            isExpanded={expandedId === req.id}
                            onToggleExpand={() => setExpandedId(expandedId === req.id ? null : req.id)}
                            onCancel={onCancel}
                            onCopy={onCopy}
                            viewMode={unifiedViewMode === 'past_all' ? 'past' : 'active'}
                            currentStudentId={studentId}
                            allStudentsList={students}
                        />
                    ))
                )}
            </div>
        </div>
    );
};
