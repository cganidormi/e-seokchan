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
    leaveTypes: string[];
    students: Student[];
    studentId: string;
}

export const LeaveStatusList: React.FC<LeaveStatusListProps> = ({
    leaveRequests,
    onCancel,
    leaveTypes,
    students,
    studentId
}) => {
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [viewMode, setViewMode] = useState<'active' | 'past'>('active');
    const [filterType, setFilterType] = useState('전체');
    const [isMyLeaveOnly, setIsMyLeaveOnly] = useState(false); // Default to ALL view as per new requirement
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
        // 이미 취소/반려된 건은 제외
        if (req.status === '취소' || req.status === '반려') return null;

        // 1. 시간표 데이터가 없거나, period 정보가 없으면 기존 end_time 사용 (fallback)
        if (!timetable || timetable.length === 0 || !req.period) {
            return new Date(req.end_time);
        }

        // 2. req.period 파싱 (예: "주간 8교시", "야간 1교시")
        // DB의 timetable_entries.description과 매칭해야 함 (예: "평일주간8교시", "평일야간1교시" 등)
        const requestDate = new Date(req.start_time);
        const isWeekendOrHoliday = isDateHoliday(requestDate);
        const dayPrefix = isWeekendOrHoliday ? '주말' : '평일';

        // req.period에서 숫자와 "주간"/"야간" 추출
        // 예: "주간 8교시" -> type: "주간", number: 8
        let type = '';
        if (req.period.includes('주간') || req.period.includes('오전') || req.period.includes('오후')) type = '주간';
        else if (req.period.includes('야간')) type = '야간';

        // 숫자 추출 (모든 숫자를 찾아서 배열로 만듦)
        // 예: "야간 1,2교시" -> matches: ["1", "2"]
        const matches = req.period.match(/(\d+)/g);

        if (!type || !matches || matches.length === 0) {
            return new Date(req.end_time);
        }

        // 여러 교시가 있을 경우 마지막 교시(가장 큰 숫자)를 사용
        // 예: "1,2교시" -> "2" 교시의 종료 시간을 기준점으로 잡음
        const numbers = matches.map(Number);
        const lastPeriodNumber = Math.max(...numbers);

        const targetDescription = `${dayPrefix}${type}${lastPeriodNumber}교시`;

        // timetable에서 매칭되는 교시 찾기
        const entry = timetable.find((t: any) => t.description === targetDescription);

        if (entry) {
            // 해당 날짜에 해당 교시의 종료 시간 적용
            const [hours, minutes, seconds] = entry.end_time.split(':').map(Number);
            const dynamicEnd = new Date(requestDate);
            dynamicEnd.setHours(hours, minutes, seconds || 0, 0);
            return dynamicEnd;
        }

        return new Date(req.end_time);
    };

    const isRequestActive = (req: any) => {
        if (req.status === '취소' || req.status === '반려') return false;

        const endTime = getDynamicEndTime(req);
        if (!endTime) return false;

        // If it's already significantly past the end time, it's definitely past
        if (endTime < now) return false;

        // Special handling for "end of day" legacy timestamps (e.g., 23:59) 
        // that might keep daytime sessions active too long.
        // If the end time is essentially midnight and it contains Daytime (주간),
        // we should expire it earlier (e.g., after 19:00).
        // -> 동적 시간표를 사용하면 이 부분은 자연스럽게 해결될 수 있으나, 안전을 위해 유지하거나 조정

        // 동적 시간표가 적용된 경우 정확한 시간이므로 추가 보정 불필요할 수 있음
        // 하지만 기존 end_time을 사용하는 fallback의 경우를 위해 유지
        if (endTime.getHours() >= 23 && req.period) {
            const isDaytime = req.period.includes('주간') || req.period.includes('오전') || req.period.includes('오후');
            const isHoliday = isDateHoliday(now);

            // 시간표가 로드되었다면 이 로직보다 시간표 우선
            if (timetable.length > 0) return true;

            if (isDaytime && !isHoliday && now.getHours() >= 19) return false;
            if (isDaytime && isHoliday && now.getHours() >= 18) return false;
        }

        return true;
    };

    const filteredByMode = (leaveRequests || []).filter(req => {
        const isActive = isRequestActive(req);
        return viewMode === 'active' ? isActive : !isActive;
    });

    // Filter by type
    const filteredByType = filteredByMode.filter(req => filterType === '전체' || req.leave_type === filterType);

    // Filter by ownership (My Only vs All)
    const displayList = filteredByType.filter(req => {
        if (!isMyLeaveOnly) return true;
        // Check if I am the main applicant OR a co-applicant
        const isMain = req.student_id === studentId;
        const isCo = req.leave_request_students?.some((s: { student_id: string }) => s.student_id === studentId);
        return isMain || isCo;
    });

    return (
        <div className="flex flex-col gap-4 w-full max-w-xl mx-auto">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-6 bg-yellow-400 rounded-full"></div>
                <h2 className="text-xl font-extrabold text-gray-800">이석현황</h2>
            </div>

            <div className="flex flex-col gap-3 pb-24">
                {/* 탭 전환 UI */}
                <div className="flex flex-wrap gap-2 mb-2">
                    {/* 내 이석만 보기 토글 */}
                    <div className="flex bg-[#1a1a1a] rounded-xl p-1 gap-1 w-fit">
                        <button
                            onClick={() => setIsMyLeaveOnly(false)}
                            className={clsx(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                !isMyLeaveOnly ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-300"
                            )}
                        >
                            전체 보기
                        </button>
                        <button
                            onClick={() => setIsMyLeaveOnly(true)}
                            className={clsx(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                isMyLeaveOnly ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-300"
                            )}
                        >
                            내 이석만
                        </button>
                    </div>

                    <div className="flex bg-[#1a1a1a] rounded-xl p-1 gap-1 w-fit">
                        <button
                            onClick={() => setViewMode('active')}
                            className={clsx(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                viewMode === 'active' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                            )}
                        >
                            진행 중
                        </button>
                        <button
                            onClick={() => setViewMode('past')}
                            className={clsx(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                viewMode === 'past' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                            )}
                        >
                            지난 내역
                        </button>
                    </div>
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
                            currentStudentId={studentId}
                        />
                    ))
                )}
            </div>
        </div>
    );
};
