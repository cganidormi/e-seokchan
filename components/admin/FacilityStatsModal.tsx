'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { supabase } from '@/supabaseClient';
import toast from 'react-hot-toast';
import { FaWrench, FaChartBar, FaSearch, FaCheck, FaTrash, FaClock } from 'react-icons/fa';

interface FacilityStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate?: Date;
}

interface FacilityItem {
    id: number;
    title: string;
    description?: string;
    status: string;
    room_number?: number;
    created_at: string;
}

export const FacilityStatsModal: React.FC<FacilityStatsModalProps> = ({
    isOpen,
    onClose,
    selectedDate
}) => {
    const [facilities, setFacilities] = useState<FacilityItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
    const [filterType, setFilterType] = useState<'today' | 'month'>('month');
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = selectedDate ? new Date(selectedDate) : new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            fetchStats();
        } else {
            document.body.style.overflow = 'unset';
        }
    }, [isOpen, selectedMonth, filterType, selectedDate]);

    const fetchStats = async () => {
        setIsLoading(true);
        try {
            let query = supabase.from('facility_requests').select('*').order('created_at', { ascending: false });

            if (filterType === 'today') {
                const now = new Date();
                const target = selectedDate ? new Date(selectedDate) : now;
                const isTargetToday =
                    target.getFullYear() === now.getFullYear() &&
                    target.getMonth() === now.getMonth() &&
                    target.getDate() === now.getDate();

                let start: Date;
                let end: Date;

                if (isTargetToday) {
                    if (now.getHours() < 18) {
                        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 18, 0, 0, 0);
                        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);
                    } else {
                        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0, 0);
                        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0, 0);
                    }
                } else {
                    start = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 18, 0, 0, 0);
                    end = new Date(target.getFullYear(), target.getMonth(), target.getDate() + 1, 9, 0, 0, 0);
                }

                query = query
                    .gte('created_at', start.toISOString())
                    .lte('created_at', end.toISOString());
            } else {
                const [year, month] = selectedMonth.split('-').map(Number);
                const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
                const end = new Date(year, month, 0, 23, 59, 59, 999);
                query = query
                    .gte('created_at', start.toISOString())
                    .lte('created_at', end.toISOString());
            }

            const { data, error } = await query;
            if (error) throw error;
            setFacilities(data || []);
        } catch (error) {
            console.error('Error fetching facility stats:', error);
            toast.error('시설물 통계를 불러오는데 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleStatus = async (id: number, currentStatus: string) => {
        const nextStatus = currentStatus === '완료' ? '미완료' : '완료';
        setFacilities(prev => prev.map(f => f.id === id ? { ...f, status: nextStatus } : f));

        try {
            const { error } = await supabase
                .from('facility_requests')
                .update({ status: nextStatus })
                .eq('id', id);
            if (error) throw error;
            toast.success(`상태가 '${nextStatus}'(으)로 변경되었습니다.`);
        } catch (err: any) {
            console.error('Update status error:', err);
            toast.error('상태 변경 실패');
            fetchStats();
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('이 수리 요청을 삭제하시겠습니까?')) return;
        setFacilities(prev => prev.filter(f => f.id !== id));

        try {
            const { error } = await supabase
                .from('facility_requests')
                .delete()
                .eq('id', id);
            if (error) throw error;
            toast.success('수리 요청이 삭제되었습니다.');
        } catch (err: any) {
            console.error('Delete facility error:', err);
            toast.error('삭제 실패');
            fetchStats();
        }
    };

    const totalCount = facilities.length;
    const completedCount = facilities.filter(f => f.status === '완료').length;
    const pendingCount = totalCount - completedCount;

    const filtered = facilities.filter(f => {
        const matchesStatus =
            statusFilter === 'all' ? true :
            statusFilter === 'completed' ? f.status === '완료' :
            f.status !== '완료';

        const q = searchTerm.trim().toLowerCase();
        const matchesSearch = !q ||
            f.title.toLowerCase().includes(q) ||
            String(f.room_number || '').includes(q) ||
            (f.description && f.description.toLowerCase().includes(q));

        return matchesStatus && matchesSearch;
    });

    if (!mounted) return null;

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="facility-stats-modal-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-[9999] flex items-center justify-center p-3 sm:p-4"
                >
                    <motion.div
                        initial={{ scale: 0.98, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.98, opacity: 0, y: 10 }}
                        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col h-[85vh] sm:h-[80vh] min-h-[480px] max-h-[92vh] overflow-hidden border border-gray-100"
                    >
                        {/* Header */}
                        <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 bg-gray-50/70 border-b border-gray-100 shrink-0">
                            <div className="flex items-center gap-3">
                                <div>
                                    <h2 className="text-base sm:text-lg font-black text-gray-900 leading-none">
                                        시설물 수리 요청 통계
                                    </h2>
                                    <p className="text-[11px] text-gray-400 font-bold mt-1">
                                        {filterType === 'today' ? '점호 기준 (18:00 ~ 익일 09:00)' : `${selectedMonth.replace('-', '년 ')}월 수리 요청 내역`}
                                    </p>
                                </div>

                                {/* Filter Toggle Tabs */}
                                <div className="flex bg-gray-200/80 p-0.5 rounded-xl border border-gray-200 ml-1">
                                    <button
                                        onClick={() => setFilterType('today')}
                                        className={clsx(
                                            "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                            filterType === 'today' ? "bg-blue-600 text-white shadow-xs" : "text-gray-600 hover:text-gray-900"
                                        )}
                                    >
                                        점호 기준
                                    </button>
                                    <button
                                        onClick={() => setFilterType('month')}
                                        className={clsx(
                                            "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                            filterType === 'month' ? "bg-blue-600 text-white shadow-xs" : "text-gray-600 hover:text-gray-900"
                                        )}
                                    >
                                        월간
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {filterType === 'month' && (
                                    <input
                                        type="month"
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(e.target.value)}
                                        className="bg-white border border-gray-200 rounded-xl px-2.5 py-1 text-xs font-bold text-gray-700 outline-none shadow-2xs cursor-pointer"
                                    />
                                )}
                                <button
                                    onClick={onClose}
                                    className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-all cursor-pointer border border-gray-200 shadow-2xs font-bold"
                                    aria-label="닫기"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Summary Badges & Search */}
                        <div className="p-4 bg-gray-50/60 border-b border-gray-100 flex flex-col gap-3 shrink-0">
                            {/* Summary Chips */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    onClick={() => setStatusFilter('all')}
                                    className={clsx(
                                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs flex items-center gap-1.5",
                                        statusFilter === 'all'
                                            ? "bg-gray-900 text-white border-gray-900"
                                            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                                    )}
                                >
                                    <span>전체</span>
                                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{totalCount}건</span>
                                </button>

                                <button
                                    onClick={() => setStatusFilter('pending')}
                                    className={clsx(
                                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs flex items-center gap-1.5",
                                        statusFilter === 'pending'
                                            ? "bg-amber-500 text-white border-amber-500"
                                            : "bg-white text-amber-700 border-amber-200 hover:bg-amber-50"
                                    )}
                                >
                                    <span>처리 중 (미완료)</span>
                                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-black">{pendingCount}건</span>
                                </button>

                                <button
                                    onClick={() => setStatusFilter('completed')}
                                    className={clsx(
                                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs flex items-center gap-1.5",
                                        statusFilter === 'completed'
                                            ? "bg-emerald-600 text-white border-emerald-600"
                                            : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                    )}
                                >
                                    <span>완료</span>
                                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-black">{completedCount}건</span>
                                </button>
                            </div>

                            {/* Search Bar */}
                            <div className="relative">
                                <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                                <input
                                    type="text"
                                    placeholder="호실, 수리 요청 내용 검색..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-gray-800 placeholder-gray-400 outline-none focus:border-blue-500 shadow-2xs transition"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold p-1"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* List Area */}
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5 bg-gray-50/30">
                            {isLoading ? (
                                <div className="py-20 flex flex-col items-center justify-center gap-3">
                                    <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-xs text-gray-400 font-bold">시설물 내역 불러오는 중...</span>
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="py-20 text-center text-gray-400 text-sm">
                                    해당 조건의 수리 요청이 없습니다.
                                </div>
                            ) : (
                                filtered.map((req) => {
                                    const isDone = req.status === '완료';
                                    const dateStr = req.created_at ? new Date(req.created_at).toLocaleString('ko-KR', {
                                        month: 'numeric',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    }) : '';

                                    return (
                                        <div
                                            key={req.id}
                                            className={clsx(
                                                "group flex items-center justify-between bg-white border rounded-2xl px-4 py-3 shadow-xs transition-all gap-3",
                                                isDone ? "border-gray-100 opacity-60 bg-gray-50/50" : "border-gray-200 hover:border-blue-300"
                                            )}
                                        >
                                            {/* Status Toggle Button */}
                                            <button
                                                type="button"
                                                onClick={() => handleToggleStatus(req.id, req.status)}
                                                title={isDone ? "미완료로 변경" : "완료로 변경"}
                                                className={clsx(
                                                    "w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer",
                                                    isDone
                                                        ? "bg-emerald-500 border-emerald-500 text-white shadow-xs"
                                                        : "border-gray-300 hover:border-blue-500 bg-white"
                                                )}
                                            >
                                                {isDone && <FaCheck className="text-xs text-white" />}
                                            </button>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    {req.room_number && (
                                                        <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                                                            {req.room_number}호
                                                        </span>
                                                    )}
                                                    <h4 className={clsx(
                                                        "font-bold text-xs sm:text-sm truncate",
                                                        isDone ? "text-gray-400 line-through" : "text-gray-900"
                                                    )}>
                                                        {req.title}
                                                    </h4>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                                                    <span className="flex items-center gap-1">
                                                        <FaClock size={10} />
                                                        {dateStr}
                                                    </span>
                                                    <span className={clsx(
                                                        "font-bold",
                                                        isDone ? "text-emerald-600" : "text-amber-600"
                                                    )}>
                                                        · {req.status || '미완료'}
                                                    </span>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleDelete(req.id)}
                                                title="삭제"
                                                className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-rose-50 text-gray-400 hover:text-rose-500 flex items-center justify-center transition-colors shrink-0 active:scale-95 cursor-pointer border border-gray-100"
                                            >
                                                <FaTrash size={11} />
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 bg-white border-t border-gray-100 flex justify-between items-center text-xs text-gray-500 shrink-0">
                            <span>총 <strong className="text-gray-800 font-bold">{filtered.length}</strong>건 표시 중</span>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                            >
                                닫기
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return createPortal(modalContent, document.body);
};
