'use client';

import React from 'react';
import clsx from 'clsx';
import { LeaveRequest } from './types';

interface LeaveProcessCardProps {
    req: LeaveRequest;
    isExpanded: boolean;
    onToggleExpand: () => void;
    isMenuOpen: boolean;
    onToggleMenu: (e: React.MouseEvent) => void;
    onUpdateStatus: (requestId: string | number, newStatus: string) => void;
    onCancel: (requestId: string | number) => void;
    viewMode: 'active' | 'past';
}

export const LeaveProcessCard: React.FC<LeaveProcessCardProps> = ({
    req,
    isExpanded,
    onToggleExpand,
    isMenuOpen,
    onToggleMenu,
    onUpdateStatus,
    onCancel,
    viewMode
}) => {
    const statusConfig = ({
        '신청': { dot: 'bg-blue-500', text: 'text-blue-500', label: '대기' },
        '승인': { dot: 'bg-green-500', text: 'text-green-500', label: '승인' },
        '반려': { dot: 'bg-red-500', text: 'text-red-500', label: '반려' },
    } as any)[req.status] || { dot: 'bg-gray-500', text: 'text-gray-500', label: req.status };

    const additionalIds = req.leave_request_students?.map(lrs => lrs.student_id) || [];
    const allStudents = [req.student_id, ...additionalIds];

    return (
        <div
            onClick={onToggleExpand}
            className={clsx(
                "bg-[#1a1a1a] border border-white/5 shadow-2xl transition-all cursor-pointer hover:bg-[#222] overflow-visible relative flex flex-col justify-center",
                isExpanded ? "rounded-[2rem] p-5" : "rounded-[2rem] px-5 py-3 min-h-[60px]",
                viewMode === 'past' && "opacity-60"
            )}
        >
            <div className="flex items-center w-full gap-3">
                {/* 1. 이석 종류 & 상태 아이콘 */}
                <div className="flex items-center gap-2 shrink-0 w-[85px]">
                    <div className={clsx(
                        "w-2 h-2 rounded-full",
                        statusConfig.dot,
                        req.status === '신청' && "animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                    )}></div>
                    <span className="text-white font-bold text-xs">{req.leave_type}</span>

                    <div className="relative shrink-0">
                        <button
                            onClick={onToggleMenu}
                            className={clsx(
                                "flex items-center px-1.5 py-0.5 rounded border border-opacity-30 transition-all duration-200 text-[10px] font-bold border-current",
                                statusConfig.text,
                                req.status === '신청' ? "bg-blue-500/10" : "bg-white/5"
                            )}
                        >
                            {req.leave_type !== '자리비움' ? statusConfig.label : ""}
                        </button>

                        {isMenuOpen && (
                            <div className="absolute top-full left-0 mt-2 bg-[#2a2a2a] border border-white/10 rounded-2xl shadow-2xl z-50 py-2 w-24 animate-in fade-in slide-in-from-top-1">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onUpdateStatus(req.id, '신청'); }}
                                    className="w-full px-4 py-2 text-left text-xs text-blue-400 hover:bg-white/5 font-bold"
                                >
                                    대기
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onUpdateStatus(req.id, '승인'); }}
                                    className="w-full px-4 py-2 text-left text-xs text-green-400 hover:bg-white/5 font-bold"
                                >
                                    승인
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onUpdateStatus(req.id, '반려'); }}
                                    className="w-full px-4 py-2 text-left text-xs text-red-400 hover:bg-white/5 font-bold"
                                >
                                    반려
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-1 items-center gap-2 min-w-0">
                    <div className="flex flex-col gap-1 shrink-0 justify-center min-w-[3rem]">
                        {allStudents.map((id, idx) => (
                            <span key={idx} className="text-gray-200 text-xs leading-tight font-medium whitespace-nowrap">
                                {id}
                            </span>
                        ))}
                    </div>
                    {/* 3. 시간 (Time - 학생 페이지와 동일한 램프 스타일) */}
                    <div className="flex flex-col gap-1 shrink-0 text-white text-xs justify-center w-32">
                        {(() => {
                            const start = new Date(req.start_time);
                            const now = new Date();
                            const day = start.getDay();
                            const isWeekend = day === 0 || day === 6;

                            if (req.period) {
                                const groups = isWeekend
                                    ? [{ label: '오전', periods: ['1', '2', '3'] }, { label: '오후', periods: ['4', '5', '6'] }, { label: '야간', periods: ['1', '2', '3'] }]
                                    : [{ label: '주간', periods: ['6', '7', '8', '9'] }, { label: '야간', periods: ['1', '2', '3', '4'] }];

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
                                const fTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                                const fDate = (d: Date) => d.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
                                return (
                                    <div className="flex flex-col gap-0.5 leading-tight">
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-1">
                                                <span className="text-gray-400 text-[11px] w-7 text-left">{fDate(start)}</span>
                                                <span className="text-yellow-400 text-[11px] font-bold">{fTime(start)}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-gray-400 text-[11px] w-7 text-left">{fDate(end)}</span>
                                                <span className="text-orange-400 text-[11px] font-bold">{fTime(end)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                        })()}
                    </div>

                    {!isExpanded && req.reason && (
                        <div className="flex items-center min-w-0 ml-4 max-w-[120px]">
                            <span className="text-gray-400 text-[11px] break-words leading-tight">
                                {req.reason}
                            </span>
                        </div>
                    )}
                </div>

                {/* 5. 취소 버튼 (우측 끝) */}
                <div className="ml-auto flex items-center shrink-0">
                    <button
                        onClick={(e) => { e.stopPropagation(); onCancel(req.id); }}
                        className="text-gray-500 hover:text-red-500 transition-colors p-1"
                        title="취소"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
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

                    {/* 신청 일시 */}
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
