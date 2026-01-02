'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { LeaveRequest } from './types';
import { LeaveProcessCard } from './LeaveProcessCard';

interface LeaveProcessListProps {
    leaveRequests: LeaveRequest[];
    onUpdateStatus: (requestId: string | number, newStatus: string) => void;
    onCancel: (requestId: string | number) => void;
    teacherName: string;
}

export const LeaveProcessList: React.FC<LeaveProcessListProps> = ({
    leaveRequests,
    onUpdateStatus,
    onCancel,
    teacherName
}) => {
    const [viewMode, setViewMode] = useState<'active' | 'past'>('active');
    const [expandedId, setExpandedId] = useState<string | number | null>(null);
    const [statusMenuId, setStatusMenuId] = useState<string | number | null>(null);

    const now = new Date();
    const filtered = (leaveRequests || []).filter(req => {
        const endTime = new Date(req.end_time);
        const isPast = endTime < now;
        return viewMode === 'active' ? !isPast : isPast;
    });

    return (
        <div className="flex flex-col w-full max-w-xl mx-auto relative">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-yellow-400 rounded-full"></div>
                    <h1 className="text-xl font-extrabold text-gray-800">이석 처리 ({teacherName} 교사)</h1>
                </div>
            </div>

            {/* 탭 전환 UI */}
            <div className="flex bg-[#1a1a1a] rounded-xl p-1 gap-1 w-fit mb-4">
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
                <button
                    onClick={() => window.location.href = '/teacher/seats'}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-yellow-400 hover:text-yellow-300"
                >
                    학습감독 자리배치도
                </button>
            </div>

            <div className="flex flex-col gap-3 pb-24">
                {filtered.length === 0 ? (
                    <div className="bg-[#1a1a1a] p-10 rounded-[2rem] border border-dashed border-white/10 text-center text-gray-600 text-xs italic">
                        {viewMode === 'active' ? '처리할 이석 내역이 없습니다.' : '지난 내역이 없습니다.'}
                        {leaveRequests.length > 0 && (
                            <p className="mt-2 text-gray-700">
                                총 {leaveRequests.length}개의 내역이 존재하나 현재 필터에 해당하지 않습니다.
                            </p>
                        )}
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
                            viewMode={viewMode}
                        />
                    ))
                )}
            </div>
        </div>
    );
};
