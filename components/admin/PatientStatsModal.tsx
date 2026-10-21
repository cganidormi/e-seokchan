'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { supabase } from '@/supabaseClient';
import toast from 'react-hot-toast';
import { FaFirstAid, FaSearch, FaTrash, FaClock, FaUser } from 'react-icons/fa';

interface PatientStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate?: Date;
}

interface PatientItem {
    id: number;
    student_id: string;
    student_name?: string;
    symptom: string;
    status: string;
    note?: string;
    created_at: string;
}

export const PatientStatsModal: React.FC<PatientStatsModalProps> = ({
    isOpen,
    onClose,
    selectedDate
}) => {
    const [patients, setPatients] = useState<PatientItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSymptom, setSelectedSymptom] = useState<string>('all');
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
            let query = supabase.from('patients').select('*').order('created_at', { ascending: false });

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

            const [patientsRes, studentsRes] = await Promise.all([
                query,
                supabase.from('students').select('student_id, name')
            ]);

            if (patientsRes.error) throw patientsRes.error;

            const studentMap = new Map(studentsRes.data?.map((s: any) => [s.student_id, s.name]));
            const merged = (patientsRes.data || []).map((p: any) => ({
                ...p,
                student_name: studentMap.get(p.student_id) || p.student_id
            }));

            setPatients(merged);
        } catch (error) {
            console.error('Error fetching patient stats:', error);
            toast.error('환자 통계를 불러오는데 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('이 환자 기록을 삭제하시겠습니까? (완치)')) return;
        setPatients(prev => prev.filter(p => p.id !== id));

        try {
            const { error } = await supabase
                .from('patients')
                .delete()
                .eq('id', id);
            if (error) throw error;
            toast.success('환자 기록이 삭제되었습니다.');
        } catch (err: any) {
            console.error('Delete patient error:', err);
            toast.error('삭제 실패');
            fetchStats();
        }
    };

    // 증상별 카운트 계산
    const symptomCounts: Record<string, number> = {};
    patients.forEach(p => {
        const s = p.symptom ? p.symptom.trim() : '기타';
        symptomCounts[s] = (symptomCounts[s] || 0) + 1;
    });

    const topSymptoms = Object.entries(symptomCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const filtered = patients.filter(p => {
        const matchesSymptom = selectedSymptom === 'all' || p.symptom === selectedSymptom;
        const q = searchTerm.trim().toLowerCase();
        const matchesSearch = !q ||
            (p.student_name && p.student_name.toLowerCase().includes(q)) ||
            p.student_id.toLowerCase().includes(q) ||
            p.symptom.toLowerCase().includes(q) ||
            (p.note && p.note.toLowerCase().includes(q));

        return matchesSymptom && matchesSearch;
    });

    if (!mounted) return null;

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="patient-stats-modal-overlay"
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
                                        환자 현황 (보건실) 통계
                                    </h2>
                                    <p className="text-[11px] text-gray-400 font-bold mt-1">
                                        {filterType === 'today' ? '점호 기준 (18:00 ~ 익일 09:00)' : `${selectedMonth.replace('-', '년 ')}월 환자 방문 내역`}
                                    </p>
                                </div>

                                {/* Filter Toggle Tabs */}
                                <div className="flex bg-gray-200/80 p-0.5 rounded-xl border border-gray-200 ml-1">
                                    <button
                                        onClick={() => setFilterType('today')}
                                        className={clsx(
                                            "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                            filterType === 'today' ? "bg-red-600 text-white shadow-xs" : "text-gray-600 hover:text-gray-900"
                                        )}
                                    >
                                        점호 기준
                                    </button>
                                    <button
                                        onClick={() => setFilterType('month')}
                                        className={clsx(
                                            "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                            filterType === 'month' ? "bg-red-600 text-white shadow-xs" : "text-gray-600 hover:text-gray-900"
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
                            {/* Symptom Filter Chips */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                    onClick={() => setSelectedSymptom('all')}
                                    className={clsx(
                                        "px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs flex items-center gap-1",
                                        selectedSymptom === 'all'
                                            ? "bg-gray-900 text-white border-gray-900"
                                            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                                    )}
                                >
                                    <span>전체</span>
                                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{patients.length}명</span>
                                </button>

                                {topSymptoms.map(([sym, count]) => (
                                    <button
                                        key={sym}
                                        onClick={() => setSelectedSymptom(selectedSymptom === sym ? 'all' : sym)}
                                        className={clsx(
                                            "px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs flex items-center gap-1",
                                            selectedSymptom === sym
                                                ? "bg-red-600 text-white border-red-600"
                                                : "bg-white text-red-700 border-red-200 hover:bg-red-50"
                                        )}
                                    >
                                        <span>{sym}</span>
                                        <span className={clsx(
                                            "px-1.5 py-0.2 rounded-full text-[10px] font-black",
                                            selectedSymptom === sym ? "bg-white/20 text-white" : "bg-red-100 text-red-700"
                                        )}>
                                            {count}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* Search Bar */}
                            <div className="relative">
                                <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                                <input
                                    type="text"
                                    placeholder="학생 이름, 학번, 증상 검색..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-gray-800 placeholder-gray-400 outline-none focus:border-red-500 shadow-2xs transition"
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
                                    <div className="w-8 h-8 border-3 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-xs text-gray-400 font-bold">환자 기록 불러오는 중...</span>
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="py-20 text-center text-gray-400 text-sm">
                                    해당 조건의 환자 기록이 없습니다.
                                </div>
                            ) : (
                                filtered.map((p) => {
                                    const dateStr = p.created_at ? new Date(p.created_at).toLocaleString('ko-KR', {
                                        month: 'numeric',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    }) : '';

                                    return (
                                        <div
                                            key={p.id}
                                            className="group flex items-center justify-between bg-white border border-gray-200 hover:border-red-300 rounded-2xl px-4 py-3 shadow-xs transition-all gap-3"
                                        >
                                            <div className="w-9 h-9 rounded-full bg-red-50 border border-red-200 text-red-600 flex items-center justify-center text-xs font-black shrink-0 shadow-2xs">
                                                {p.student_name ? p.student_name[0] : '환'}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-extrabold text-sm text-gray-900">
                                                        {p.student_name}
                                                    </span>
                                                    <span className="text-xs text-gray-400 font-medium">
                                                        ({p.student_id})
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                                                        {p.symptom}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                                                    <span className="flex items-center gap-1">
                                                        <FaClock size={10} />
                                                        {dateStr}
                                                    </span>
                                                    {p.note && (
                                                        <span className="text-gray-500 truncate">
                                                            · {p.note}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleDelete(p.id)}
                                                title="완치 (기록 삭제)"
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
                            <span>총 <strong className="text-gray-800 font-bold">{filtered.length}</strong>명 표시 중</span>
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
