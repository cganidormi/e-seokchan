'use client';

import React from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
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
    currentTeacherId: string;
    showOpacityForPast?: boolean;
    hideActionButtons?: boolean;
}

export const LeaveProcessCard: React.FC<LeaveProcessCardProps> = ({
    req,
    isExpanded,
    onToggleExpand,
    isMenuOpen,
    onToggleMenu,
    onUpdateStatus,
    onCancel,
    viewMode,
    currentTeacherId,
    showOpacityForPast = true,
    hideActionButtons = false
}) => {
    const statusConfig = ({
        '신청': { dot: 'bg-blue-500', text: 'text-blue-500', label: '대기' },
        '승인': { dot: 'bg-green-500', text: 'text-green-500', label: '승인' },
        '반려': { dot: 'bg-red-500', text: 'text-red-500', label: '반려' },
        '거절': { dot: 'bg-red-500', text: 'text-red-500', label: '반려' },
        '취소': { dot: 'bg-gray-500', text: 'text-gray-500', label: '취소' },
        '복귀': { dot: 'bg-gray-400', text: 'text-gray-400', label: '복귀' },
    } as any)[req.status] || { dot: 'bg-gray-500', text: 'text-gray-500', label: req.status };

    const additionalIds = req.leave_request_students?.map(lrs => lrs.student_id) || [];
    const allStudents = [req.student_id, ...additionalIds];

    // Permission Check: Only the assigned teacher can edit, and only in 'active' view
    // '학부모승인' 상태도 교사가 처리해야 함 (사실상 '신청'과 동일하게 취급)
    const canEdit = req.teacher_id === currentTeacherId && viewMode === 'active' && (req.status === '신청' || req.status === '승인');

    const handleApprove = (e: React.MouseEvent) => {
        if (!canEdit) return;
        e.stopPropagation();

        const type = req.leave_type ? req.leave_type.trim() : '';

        // 최종 승인 처리
        onUpdateStatus(req.id, '승인');
    };

    const handleEarlyReturn = (e: React.MouseEvent) => {
        if (viewMode !== 'active') return;
        e.stopPropagation();
        if (!confirm("외출·외박 조기 복귀 시 사용하는 기능입니다.\n\n정말로 조기 복귀 처리하시겠습니까?")) return;
        onUpdateStatus(req.id, '복귀');
    };

    return (
<div
    onClick={onToggleExpand}
    className={clsx(
        "bg-[#1a1a1a] border border-white/5 shadow-2xl transition-all cursor-pointer hover:bg-[#222] overflow-visible relative flex flex-col justify-center",
        // 👇 기존 h-[80px] 또는 h-[96px]를 지우고 딱 이 줄로 바꾸세요!
        isExpanded ? "rounded-[2rem] p-5" : "rounded-[2rem] px-4 py-3 !h-[60px]",
        viewMode === 'past' && showOpacityForPast && "opacity-60 grayscale-[40%] saturate-50 contrast-90 backdrop-blur-sm bg-[#121212]/90"
    )}
>
            <div className="flex items-center w-full gap-2">
                {/* 1. 이석 종류 & 상태 아이콘 (컬럼 1: 타이트한 고정 너비 70px) */}
                <div className="flex items-center gap-1.5 shrink-0 w-[70px]">
                    <div className={clsx(
                        "w-2 h-2 rounded-full shrink-0",
                        statusConfig.dot,
                        (req.status === '신청' || req.status === '학부모승인' || req.status === '승인대기' || req.status === '학부모승인대기') && "animate-pulse shadow-[0_0_8px_rgba(56,189,248,0.6)]"
                    )}></div>

                    <div className="flex items-center gap-1 min-w-0">
                        <span className="text-white font-bold text-xs text-left whitespace-nowrap">{req.leave_type}</span>

                        {req.leave_type !== '컴이석' && req.leave_type !== '자리비움' && (
                            <div className="relative shrink-0">
                                {/* Status Change Button - Only if canEdit */}
                                <button
                                    onClick={canEdit ? onToggleMenu : (e) => e.stopPropagation()}
                                    className={clsx(
                                        "flex items-center px-1.5 py-0.5 rounded border border-opacity-30 transition-all duration-200 text-[10px] font-bold border-current",
                                        statusConfig.text,
                                        canEdit && req.status === '신청' ? "bg-blue-500/10" : "bg-white/5",
                                        !canEdit && "opacity-50 cursor-default"
                                    )}
                                    disabled={!canEdit}
                                >
                                    {statusConfig.label}
                                </button>

                                {isMenuOpen && canEdit && (
                                    <div className="absolute top-full left-0 mt-2 bg-[#2a2a2a] border border-white/10 rounded-2xl shadow-2xl z-50 py-2 w-24 animate-in fade-in slide-in-from-top-1">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onUpdateStatus(req.id, '신청'); }}
                                            className="w-full px-4 py-2 text-left text-xs text-blue-400 hover:bg-white/5 font-bold"
                                        >
                                            대기
                                        </button>
                                        <button
                                            onClick={handleApprove}
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
                        )}
                    </div>
                </div>

                {/* 2. 학생 정보 (컬럼 2: 좌측 정렬 & 밀착 65px) */}
                <div className="flex flex-col gap-0.5 shrink-0 justify-center items-start w-[65px]">
                    <span className="text-gray-200 text-xs leading-tight whitespace-nowrap font-bold truncate max-w-full">
                        {req.student_id}
                    </span>
                    {allStudents.length > 1 && (
                        <span className="text-gray-300 text-[10px] leading-tight whitespace-nowrap font-medium">
                            외 {allStudents.length - 1}명
                        </span>
                    )}
                </div>

                {/* 3. 날짜 & 교시 / 시간 (컬럼 3: 고정 너비 125px) */}
                <div className="flex flex-col gap-1 shrink-0 text-white text-xs justify-center w-[125px]">
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
                                <div className="flex flex-col gap-1.5 justify-center">
                                    <div className="flex flex-col gap-1 justify-center">
                                        {groups.map((group, gIdx) => (
                                            <div key={gIdx} className="flex gap-1 items-center">
                                                <span className="text-[11px] text-gray-400 font-medium w-[32px] shrink-0 text-left whitespace-nowrap">
                                                    {gIdx === 0 ? `${start.getMonth() + 1}.${start.getDate()}` : ""}
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
                            const end = req.leave_type === '자리비움'
                                ? new Date(new Date(req.start_time).getTime() + 10 * 60000)
                                : new Date(req.end_time);
                            const fTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                            const fDate = (d: Date) => `${d.getMonth() + 1}.${d.getDate()}`;
                            return (
                                <div className="flex flex-col gap-0.5 leading-tight justify-center">
                                    <div className="flex flex-col gap-0.5 justify-center">
                                        <div className="flex items-center gap-[3px]">
                                            <span className="text-gray-400 text-[11px] w-[32px] shrink-0 text-left whitespace-nowrap">{fDate(start)}</span>
                                            <span className="text-yellow-400 text-[11px] font-bold">{fTime(start)}</span>
                                        </div>
                                        <div className="flex items-center gap-[3px]">
                                            <span className="text-gray-400 text-[11px] w-[32px] shrink-0 text-left whitespace-nowrap">{fDate(end)}</span>
                                            <span className="text-orange-400 text-[11px] font-bold">{fTime(end)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                    })()}
                </div>

                {/* 4. 사유 (컬럼 4: 나머지 영역) */}
                <div className="flex flex-1 items-center min-w-0">
                    {req.reason && (
                        <span className="text-gray-400 text-xs font-medium truncate w-full" title={req.reason}>
                            {req.reason}
                        </span>
                    )}
                </div>

                {/* 5. 취소 및 복귀 버튼 (우측 끝) - 모든 교사에게 개방 */}
                {viewMode === 'active' && !hideActionButtons && (
                    <div className="ml-auto flex items-center gap-2 shrink-0">
                        {/* 
                           조기 복귀 Logic:
                           - 승인 상태 AND (외출 OR 외박)
                           - 시작 시간이 지났을 때만 '복귀' 버튼 노출
                           - 시작 전이면 '취소(X)' 버튼 노출
                        */}
                        {(() => {
                            const isOutingOrOvernight = req.leave_type === '외출' || req.leave_type === '외박';
                            const isApproved = req.status === '승인';
                            const now = new Date();
                            const startTime = new Date(req.start_time);
                            const hasStarted = now >= startTime;

                            if (isApproved && isOutingOrOvernight && hasStarted) {
                                return (
                                    <button
                                        onClick={handleEarlyReturn}
                                        className="px-2 py-1 bg-gray-700 text-gray-300 text-[10px] font-bold rounded hover:bg-gray-600 transition-colors border border-white/10"
                                    >
                                        복귀
                                    </button>
                                );
                            }

                            // 그 외의 경우:
                            // 승인된 상태라면 -> 이미 승인되었으므로 '삭제(취소)' 불가 (기록 보존)
                            if (isApproved) return null;

                            // 아직 승인되지 않은 상태(신청, 학부모승인대기 등) -> 취소(삭제) 가능
                            return (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onCancel(req.id); }}
                                    className="text-gray-500 hover:text-red-500 transition-colors p-1"
                                    title="취소/삭제"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            );
                        })()}
                    </div>
                )}
            </div>

            {
                isExpanded && (
                    <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
                        <div className="grid grid-cols-3 gap-4 text-xs">
                            {req.leave_type !== '컴이석' ? (
                                <>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-gray-500 font-bold">지도교사</span>
                                        <span className={`font-bold ${req.teacher_id === currentTeacherId ? "text-green-400" : "text-white"}`}>
                                            {req.teachers?.name || '-'}
                                        </span>
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

                        {/* 함께하는 학생들 (Companion students) - Moved to top of expanded view for visibility */}
                        {additionalIds.length > 0 && (
                            <div className="flex flex-col gap-2 p-3 bg-blue-500/5 rounded-2xl border border-blue-500/20 mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-1 h-3 bg-blue-500 rounded-full"></span>
                                    <span className="text-blue-400 font-bold text-[11px]">함께하는 학생들 ({allStudents.length}명)</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 items-center">
                                    {allStudents.map((id, idx) => {
                                        const isMain = id === req.student_id;
                                        // Case-insensitive/trim check for robustness
                                        const studentLabel = typeof id === 'string' ? id : String(id || '알 수 없음');

                                        return (
                                            <div key={`${id}-${idx}`} className={clsx(
                                                "px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all text-[10px] font-bold",
                                                isMain
                                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                                    : "bg-[#2a2a2a] text-gray-300 border border-white/5"
                                            )}>
                                                {isMain && <span className="text-[8px] bg-white/20 px-1 rounded">대표</span>}
                                                <span>{studentLabel}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 신청 일시 */}
                        <div className="flex flex-col gap-1">
                            <span className="text-gray-500 font-bold">신청 일시</span>
                            <span className="text-gray-400 text-xs">
                                {new Date(req.created_at).toLocaleString()}
                            </span>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
