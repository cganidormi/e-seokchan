'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { LeaveRequest, Student } from './types';
import Select from 'react-select';

interface LeaveStatusCardProps {
    req: LeaveRequest;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onCancel: (id: number) => void;
    viewMode: 'active' | 'past';
}

export const LeaveStatusCard: React.FC<LeaveStatusCardProps> = ({
    req,
    isExpanded,
    onToggleExpand,
    onCancel,
    viewMode,
}) => {
    const statusConfig = ({
        '신청': { dot: 'bg-blue-500', text: 'text-blue-500', label: '대기' },
        '승인': { dot: 'bg-green-500', text: 'text-green-500', label: '승인' },
        '반려': { dot: 'bg-red-500', text: 'text-red-500', label: '반려' },
        '취소': { dot: 'bg-gray-500', text: 'text-gray-500', label: '취소' },
    } as any)[req.status] || { dot: 'bg-gray-500', text: 'text-gray-500', label: req.status };

    const additionalIds = req.leave_request_students?.map(lrs => lrs.student_id).filter(Boolean) || [];
    const allStudents = [req.student_id, ...additionalIds].filter(Boolean);
    const isPast = viewMode === 'past';

    return (
        <div
            onClick={onToggleExpand}
            className={clsx(
                "bg-[#1a1a1a] border border-white/5 shadow-2xl transition-all cursor-pointer hover:bg-[#222] overflow-visible relative flex flex-col justify-center",
                isExpanded ? "rounded-[2rem] p-5" : "rounded-[2rem] px-5 py-3 min-h-[60px]",
                isPast && "opacity-60"
            )}
        >
            {/* 상단 한 줄 요약 (Collapsed & Expanded Header) */}
            <div className="flex items-center w-full gap-3">
                {/* 1. 상태 아이콘 & 이석 종류 */}
                <div className="flex items-center gap-2 shrink-0 w-[85px]">
                    <div className={clsx(
                        "w-2 h-2 rounded-full",
                        statusConfig.dot,
                        req.status === '신청' && "animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                    )}></div>
                    <span className="text-white font-bold text-xs">{req.leave_type}</span>
                    {(req.leave_type !== '컴이석' && req.leave_type !== '자리비움') && (
                        <span className={clsx("text-[10px] px-1.5 py-0.5 rounded border border-opacity-30", statusConfig.text, "border-current")}>
                            {statusConfig.label}
                        </span>
                    )}
                </div>

                <div className="flex flex-1 items-center gap-2 min-w-0">
                    {/* 2. 신청자 (세로 나열) */}
                    <div className="flex flex-col gap-1 shrink-0 justify-center min-w-[3rem]">
                        {allStudents.map((id, idx) => (
                            <span key={idx} className="text-gray-200 text-xs leading-tight whitespace-nowrap">
                                {id}
                            </span>
                        ))}
                    </div>

                    {/* 3. 시간 (Time - 교시 램프 스타일 & 날짜 조건부 표시) */}
                    <div className="flex flex-col gap-1 shrink-0 text-white text-xs justify-center w-32">
                        {(() => {
                            const start = new Date(req.start_time);
                            const day = start.getDay();
                            const isWeekend = day === 0 || day === 6;

                            if (req.period) {
                                const groups = isWeekend
                                    ? [
                                        { label: '오전', periods: ['1', '2', '3'] },
                                        { label: '오후', periods: ['4', '5', '6'] },
                                        { label: '야간', periods: ['1', '2', '3'] }
                                    ]
                                    : [
                                        { label: '주간', periods: ['6', '7', '8', '9'] },
                                        { label: '야간', periods: ['1', '2', '3', '4'] }
                                    ];

                                const activePeriods = req.period.split(',').map(p => p.trim());

                                return (
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex flex-col gap-1">
                                            {groups.map((group, gIdx) => (
                                                <div key={gIdx} className="flex gap-1 items-center">
                                                    <span className="text-[11px] text-gray-400 font-medium w-7 text-left">
                                                        {gIdx === 0 ? start.toLocaleDateString([], { month: 'numeric', day: 'numeric' }) : ""}
                                                    </span>
                                                    <div className="flex gap-1 items-center">
                                                        {group.periods.map(p => {
                                                            const periodLabel = `${group.label}${p}교시`;
                                                            const isActive = activePeriods.includes(periodLabel);

                                                            return (
                                                                <div
                                                                    key={p}
                                                                    className={clsx(
                                                                        "w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black transition-all",
                                                                        isActive
                                                                            ? "bg-yellow-400 text-black shadow-[0_0_8px_rgba(250,204,21,0.6)]"
                                                                            : "bg-white/5 text-white/20 border border-white/5"
                                                                    )}
                                                                >
                                                                    {p}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            } else {
                                const end = new Date(req.end_time);
                                const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                                const formatDate = (d: Date) => d.toLocaleDateString([], { month: 'numeric', day: 'numeric' });

                                return (
                                    <div className="flex flex-col gap-0.5 leading-tight">
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-gray-400 text-[11px] w-7 text-left">{formatDate(start)}</span>
                                                <span className="text-yellow-400 text-[11px] font-bold">{formatTime(start)}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-gray-400 text-[11px] w-7 text-left">{formatDate(end)}</span>
                                                <span className="text-orange-400 text-[11px] font-bold">{formatTime(end)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                        })()}
                    </div>

                    {!isExpanded && req.reason && (
                        <div className="flex items-center min-w-0 ml-1 max-w-[120px]">
                            <span className="text-gray-400 text-[11px] break-words leading-tight">
                                {req.reason}
                            </span>
                        </div>
                    )}
                </div>

                {/* 5. 취소 버튼 (우측 끝) */}
                {!isPast && (
                    <div className="ml-auto flex items-center shrink-0">
                        {req.status !== '취소' && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onCancel(req.id); }}
                                className="text-gray-500 hover:text-red-500 transition-colors p-1"
                                title="취소"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-3 gap-4 text-xs">
                        {req.leave_type !== '컴이석' ? (
                            <>
                                <div className="flex flex-col gap-1">
                                    <span className="text-gray-500 font-bold">지도교사</span>
                                    <span className="text-white">{req.teachers?.name || '-'}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-gray-500 font-bold">장소</span>
                                    <span className="text-white">{req.place || '-'}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-gray-500 font-bold">사유</span>
                                    <span className="text-white">{req.reason || '-'}</span>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col gap-1 col-span-3">
                                <span className="text-gray-500 font-bold italic text-[10px]">컴이석은 별도 장소/사유가 필요하지 않습니다.</span>
                            </div>
                        )}
                    </div>

                    {additionalIds.length > 0 && (
                        <div className="flex flex-col gap-1">
                            <span className="text-gray-500 font-bold">함께하는 학생들</span>
                            <div className="flex flex-wrap gap-1.5 items-center">
                                {allStudents.map(id => (
                                    <div key={id} className="bg-gray-800 px-2 py-1 rounded text-gray-300 flex items-center gap-1">
                                        <span>{id}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col gap-1">
                        <span className="text-gray-500 font-bold">신청 일시</span>
                        <span className="text-gray-400 text-xs">
                            {new Date(req.created_at).toLocaleString()}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};
