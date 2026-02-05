'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { supabase } from '@/supabaseClient';
import { LeaveRequest, Student } from './types';
import { FaUser } from 'react-icons/fa';

interface LeaveStatusCardProps {
    req: LeaveRequest;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onCancel: (id: number) => void;
    onCopy?: (req: LeaveRequest) => void;
    viewMode: 'active' | 'past';
    currentStudentId: string;
    allStudentsList?: Student[];
}

export const LeaveStatusCard: React.FC<LeaveStatusCardProps> = ({
    req,
    isExpanded,
    onToggleExpand,
    onCancel,
    onCopy,
    viewMode,
    currentStudentId,
    allStudentsList = []
}) => {
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

    // Initial Setting for Edit Mode
    const openManageModal = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (req.status !== '신청') return;
        if (req.student_id !== currentStudentId) return;

        const currentAdditional = req.leave_request_students?.map(lrs => lrs.student_id).filter(Boolean) || [];
        setSelectedStudents(currentAdditional);
        setSearchQuery('');
        setIsManageModalOpen(true);
    };

    const handleAddStudent = (studentIdToAdd: string) => {
        if (studentIdToAdd === currentStudentId) {
            toast.error('본인은 추가할 수 없습니다.');
            return;
        }
        if (selectedStudents.includes(studentIdToAdd)) {
            toast.error('이미 추가된 학생입니다.');
            return;
        }
        setSelectedStudents(prev => [...prev, studentIdToAdd]);
        setSearchQuery('');
    };

    const handleRemoveStudent = (studentIdToRemove: string) => {
        setSelectedStudents(prev => prev.filter(id => id !== studentIdToRemove));
    };

    const handleSaveStudents = async () => {
        try {
            // 1. Delete existing connections
            const { error: deleteError } = await supabase
                .from('leave_request_students')
                .delete()
                .eq('leave_request_id', req.id);

            if (deleteError) throw deleteError;

            // 2. Insert new connections
            if (selectedStudents.length > 0) {
                const rows = selectedStudents.map(sid => ({
                    leave_request_id: req.id,
                    student_id: sid
                }));
                const { error: insertError } = await supabase
                    .from('leave_request_students')
                    .insert(rows);

                if (insertError) throw insertError;
            }

            toast.success('신청 인원이 수정되었습니다.');
            setIsManageModalOpen(false);
            // Realtime subscription in parent should refresh the list
        } catch (err) {
            console.error(err);
            toast.error('수정 중 오류가 발생했습니다.');
        }
    };

    const statusConfig = ({
        '신청': { dot: 'bg-blue-500', text: 'text-blue-500', label: '대기' },
        '승인': { dot: 'bg-green-500', text: 'text-green-500', label: '승인' },
        '반려': { dot: 'bg-red-500', text: 'text-red-500', label: '반려' },
        '취소': { dot: 'bg-gray-500', text: 'text-gray-500', label: '취소' },
        '학부모승인대기': { dot: 'bg-orange-500', text: 'text-orange-500', label: '학부모대기' },
        '학부모승인': { dot: 'bg-blue-500', text: 'text-blue-500', label: '학부모승인' },
        '복귀': { dot: 'bg-gray-400', text: 'text-gray-400', label: '복귀' },
    } as any)[req.status] || { dot: 'bg-gray-500', text: 'text-gray-500', label: req.status };

    const additionalIds = req.leave_request_students?.map(lrs => lrs.student_id).filter(Boolean) || [];
    const allStudents = [req.student_id, ...additionalIds].filter(Boolean);
    const isPast = viewMode === 'past';
    const canEdit = !isPast && req.status === '신청' && req.student_id === currentStudentId;

    // Filter for Autocomplete
    const filteredStudents = allStudentsList.filter(s =>
        s.student_id.includes(searchQuery) || s.name.includes(searchQuery)
    ).slice(0, 5); // Limit suggestions

    return (
        <>
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
                            req.status === '신청' || req.status === '학부모승인' && "animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                        )}></div>
                        <span className="text-white font-bold text-xs">{req.leave_type}</span>
                        {(req.leave_type !== '컴이석' && req.leave_type !== '자리비움') && (
                            <span className={clsx("text-[10px] px-1.5 py-0.5 rounded border border-opacity-30 whitespace-nowrap", statusConfig.text, "border-current")}>
                                {statusConfig.label}
                            </span>
                        )}
                    </div>

                    <div
                        className={clsx(
                            "flex flex-col gap-1 shrink-0 justify-center min-w-[3rem]",
                            canEdit && "cursor-pointer p-1 -m-1 rounded hover:bg-white/5 group relative"
                        )}
                        onClick={canEdit ? openManageModal : undefined}
                        title={canEdit ? "클릭하여 인원 수정" : ""}
                    >
                        {allStudents.map((id, idx) => (
                            <span key={idx} className="text-gray-200 text-xs leading-tight whitespace-nowrap flex items-center gap-1">
                                {id}
                            </span>
                        ))}
                        {canEdit && (
                            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 flex items-center gap-0.5 bg-gray-800/90 rounded-full px-1.5 py-0.5 border border-white/10 shadow-sm z-10">
                                <span className="text-[8px] text-blue-400 font-bold">+</span>
                                <FaUser size={8} className="text-gray-300" />
                                <span className="text-[8px] text-red-400 font-bold">-</span>
                            </div>
                        )}
                    </div>

                    {/* 3. 시간 (Time - 교시 램프 스타일 & 날짜 조건부 표시) */}
                    <div className="flex flex-col gap-1 shrink-0 text-white text-xs justify-center">
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
                                const end = req.leave_type === '자리비움'
                                    ? new Date(new Date(req.start_time).getTime() + 10 * 60000)
                                    : new Date(req.end_time);
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

                    {/* 4. 사유 (Reason) */}
                    {req.reason && (
                        <div className="flex items-center shrink-0">
                            <span className="text-gray-400 text-xs font-medium" title={req.reason}>
                                {req.reason.length > 6 ? req.reason.slice(0, 6) + '...' : req.reason}
                            </span>
                        </div>
                    )}
                </div>

                {/* 5. 따라가기 버튼 (내가 아닌 경우, "이석" or "컴이석" 한정, 지난 내역 제외) */}
                {req.student_id !== currentStudentId && onCopy && !isPast && (req.leave_type === '이석' || req.leave_type === '컴이석') && (
                    <div className="flex items-center shrink-0 ml-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); onCopy(req); }}
                            className="text-[10px] bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white px-2 py-1 rounded-full transition-all border border-blue-500/30 flex items-center gap-1"
                            title="이 내용으로 신청하기"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                            </svg>
                            <span className="hidden sm:inline">따라가기</span>
                        </button>
                    </div>
                )}

                {/* 6. 취소 버튼 (우측 끝) */}
                {!isPast && (
                    <div className="ml-auto flex items-center shrink-0">
                        {req.student_id === currentStudentId && (
                            req.status === '신청' ||
                            req.status === '학부모승인' ||
                            req.status === '학부모승인대기' ||
                            req.status === '승인' ||
                            req.status === '승인전' ||
                            req.leave_type === '컴이석'
                        ) && (
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
                                {allStudents.map(id => {
                                    const isMe = id === currentStudentId;
                                    const isMain = id === req.student_id;
                                    // Allow withdrawal if: I am this student, I am NOT the main applicant, and status is Approved/Pending/ParentPending
                                    const canWithdraw = isMe && !isMain && (req.status === '승인' || req.status === '신청' || req.status === '학부모승인대기');

                                    return (
                                        <div key={id} className={clsx(
                                            "px-2 py-1 rounded flex items-center gap-1 transition-colors",
                                            isMe ? "bg-blue-900/40 text-blue-200 border border-blue-500/30 font-bold" : "bg-gray-800 text-gray-300"
                                        )}>
                                            <span>{id}</span>
                                            {canWithdraw && (
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (!confirm('정말로 이석 명단에서 빠지시겠습니까?')) return;
                                                        try {
                                                            const { error } = await supabase
                                                                .from('leave_request_students')
                                                                .delete()
                                                                .eq('leave_request_id', req.id)
                                                                .eq('student_id', currentStudentId);

                                                            if (error) throw error;
                                                            toast.success('명단에서 제외되었습니다.');
                                                            // Realtime subscription will refresh the list, or we could optimistic update
                                                        } catch (err) {
                                                            console.error(err);
                                                            toast.error('오류가 발생했습니다.');
                                                        }
                                                    }}
                                                    className="ml-1 text-blue-400 hover:text-red-400 p-0.5 rounded-full hover:bg-white/10 transition-colors"
                                                    title="명단에서 빠지기"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
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

            {/* --- Manage Modal --- */}
            {isManageModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={(e) => { e.stopPropagation(); setIsManageModalOpen(false); }}
                >
                    <div
                        className="bg-[#1f1f1f] w-full max-w-sm rounded-2xl shadow-2xl p-6 border border-white/10 relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold text-white mb-4">함께하는 학생 수정</h3>

                        <div className="space-y-4">
                            {/* Current List */}
                            <div className="flex flex-wrap gap-2">
                                <div className="bg-blue-900/40 text-blue-200 px-3 py-1.5 rounded-lg text-sm border border-blue-500/30 flex items-center gap-2">
                                    <span>{req.student_id} (대표)</span>
                                </div>
                                {selectedStudents.map(sid => (
                                    <div key={sid} className="bg-gray-800 text-gray-200 px-3 py-1.5 rounded-lg text-sm border border-white/10 flex items-center gap-2 group">
                                        <span>{sid}</span>
                                        <button
                                            onClick={() => handleRemoveStudent(sid)}
                                            className="text-gray-500 hover:text-red-400"
                                        >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Add Input */}
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="이름 또는 학번 검색..."
                                    className="w-full bg-[#111] text-white border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />

                                {/* Create a portal-like dropdown or just absolute */}
                                {searchQuery.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#2a2a2a] border border-white/10 rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
                                        {filteredStudents.length > 0 ? filteredStudents.map(student => (
                                            <button
                                                key={student.student_id}
                                                className="w-full text-left px-4 py-2.5 hover:bg-white/5 text-sm text-gray-200 border-b border-white/5 last:border-0"
                                                onClick={() => handleAddStudent(student.student_id)}
                                            >
                                                <span className="font-bold text-white">{student.name}</span>
                                                <span className="text-gray-500 text-xs ml-2">{student.student_id}</span>
                                            </button>
                                        )) : (
                                            <div className="p-4 text-center text-gray-500 text-xs">검색 결과가 없습니다.</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setIsManageModalOpen(false)}
                                    className="flex-1 py-3 bg-gray-700 text-gray-300 rounded-xl font-bold text-sm hover:bg-gray-600 transition-colors"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleSaveStudents}
                                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-500 shadow-lg shadow-blue-900/30 transition-all"
                                >
                                    저장하기
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
        </>
    );
};
