'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { supabase } from '@/supabaseClient';
import { FaChartBar, FaSearch, FaDoorOpen, FaClock, FaBroom, FaUtensils, FaBoxOpen, FaSignOutAlt } from 'react-icons/fa';
import { Student } from '@/components/student/types';

interface ViolationStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface StudentViolationCount extends Student {
    count: number;
    details: any[];
}

const VIOLATION_ICONS: Record<string, React.ElementType> = {
    '스토퍼 미설치': FaDoorOpen,
    '일과시간 미준수': FaClock,
    '청소불량': FaBroom,
    '음식물 섭취 위반': FaUtensils,
    '박스 방치': FaBoxOpen,
    '퇴실수칙 불이행': FaSignOutAlt
};

export const ViolationStatsModal: React.FC<ViolationStatsModalProps> = ({ isOpen, onClose }) => {
    const [students, setStudents] = useState<StudentViolationCount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchStats();
            document.body.style.overflow = 'hidden';
        } else if (!document.querySelector('.modal-open')) {
            const otherModals = document.querySelectorAll('[key*="modal-overlay"]');
            if (otherModals.length <= 1) {
                document.body.style.overflow = 'unset';
            }
        }
    }, [isOpen, selectedMonth]);

    const fetchStats = async () => {
        setIsLoading(true);
        try {
            const { data: studentsData } = await supabase
                .from('students')
                .select('*')
                .order('student_id');

            const [year, month] = selectedMonth.split('-');
            const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString();
            const endOfMonth = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999).toISOString();

            const { data: violationData } = await supabase
                .from('morning_checks')
                .select('*')
                .eq('type', 'late')
                .gte('checked_at', startOfMonth)
                .lte('checked_at', endOfMonth);

            if (studentsData) {
                const violationMap = new Map();
                violationData?.forEach(v => {
                    const existing = violationMap.get(v.student_id) || [];
                    violationMap.set(v.student_id, [...existing, v]);
                });

                const merged = studentsData
                    .filter(s => !(s.grade === 3 && s.class === 3 && s.number === 17 && s.name === '홍길동'))
                    .map(s => ({
                        ...s,
                        count: (violationMap.get(s.student_id) || []).length,
                        details: violationMap.get(s.student_id) || []
                    }))
                    .filter(s => s.count > 0)
                    .sort((a, b) => {
                        if (b.count !== a.count) return b.count - a.count;
                        return a.student_id.localeCompare(b.student_id);
                    });

                setStudents(merged);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filtered = students.filter(s => 
        s.name.includes(searchTerm) || s.student_id.includes(searchTerm)
    );

    const modalContent = (
        <>
            <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="violation-stats-modal-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[9999] flex items-center justify-center p-2 sm:p-4"
                >
                    <motion.div
                        initial={{ scale: 0.98, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.98, opacity: 0, y: 10 }}
                        className="bg-white w-full max-w-[95vw] lg:max-w-6xl rounded-3xl shadow-2xl flex flex-col max-h-[96vh] overflow-hidden border border-gray-100"
                    >
                        {/* Compact Header */}
                        <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-rose-500 rounded-lg shadow-sm shadow-rose-100">
                                    <FaChartBar className="text-white text-sm" />
                                </div>
                                <div>
                                    <h2 className="text-base font-black text-gray-900 leading-none">위반 통계 요약</h2>
                                    <p className="text-[10px] text-gray-400 font-bold mt-0.5">이달의 위반자 명단</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 flex-grow sm:flex-grow-0 min-w-0">
                                <div className="relative flex-grow sm:w-48">
                                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-[10px]" />
                                    <input
                                        type="text"
                                        placeholder="이름/학번..."
                                        className="w-full bg-white border border-gray-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold focus:ring-1 focus:ring-rose-200 outline-none transition-all placeholder:text-gray-300"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <input
                                    type="month"
                                    className="bg-white border border-gray-200 rounded-xl px-2 py-1.5 text-xs font-black text-gray-700 focus:ring-1 focus:ring-rose-200 outline-none"
                                    value={selectedMonth}
                                    onChange={e => setSelectedMonth(e.target.value)}
                                />
                                <button 
                                    onClick={onClose} 
                                    className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all text-sm font-bold ml-1"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* High-Density Content */}
                        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-white">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-[11px] font-bold text-gray-400">데이터 로딩 중...</p>
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-gray-200">
                                    <FaSearch size={32} className="mb-2 opacity-30" />
                                    <p className="text-xs font-bold">위반 학생이 없습니다.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1.5">
                                    {filtered.map((student, idx) => {
                                        const violationSummary = Array.from(new Set(student.details.map(d => d.note)));
                                        return (
                                            <div 
                                                key={student.student_id || `student-idx-${idx}`} 
                                                className={clsx(
                                                    "relative p-2 rounded-2xl border transition-all group overflow-hidden",
                                                    student.count >= 3 
                                                        ? "bg-rose-50 border-rose-100 shadow-sm" 
                                                        : "bg-gray-50 border-gray-100 hover:bg-white hover:border-gray-200 hover:shadow-sm"
                                                )}
                                            >
                                                {/* Count Badge - Top Right Mini */}
                                                <div className={clsx(
                                                    "absolute top-1.5 right-1.5 w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black shadow-xs",
                                                    student.count >= 3 ? "bg-rose-500 text-white" : "bg-white text-rose-600 border border-rose-100"
                                                )}>
                                                    {student.count}
                                                </div>

                                                <div className="mb-1">
                                                    <span className="text-[8px] font-black text-gray-400 block tracking-tight leading-none mb-0.5">{student.student_id}</span>
                                                    <span className="text-xs font-black text-gray-800 line-clamp-1">{student.name}</span>
                                                </div>
                                                
                                                <div className="flex flex-wrap gap-0.5">
                                                    {violationSummary.slice(0, 4).map((note, nIdx) => {
                                                        const Icon = VIOLATION_ICONS[note] || FaChartBar;
                                                        return (
                                                            <div 
                                                                key={nIdx} 
                                                                title={note}
                                                                className="w-4 h-4 bg-white/60 rounded-md flex items-center justify-center text-gray-400 group-hover:text-rose-400 transition-colors"
                                                            >
                                                                <Icon size={10} />
                                                            </div>
                                                        );
                                                    })}
                                                    {violationSummary.length > 4 && (
                                                        <div className="text-[7px] font-black text-gray-300 self-center">+{violationSummary.length - 4}</div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Minimal Footer */}
                        <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-rose-500 shadow-sm"></div>
                                    <span className="text-[10px] font-bold text-gray-500">3회 이상 (관찰 대상)</span>
                                </div>
                                <div className="text-[10px] font-bold text-gray-400">
                                    기록 인원: <span className="text-gray-900 font-black">{students.length}</span>명
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={onClose}
                                    className="px-6 py-1.5 bg-gray-900 text-white font-black rounded-xl hover:bg-black active:scale-95 transition-all text-[11px]"
                                >
                                    닫기
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
            </AnimatePresence>
        </>
    );

    if (!mounted || typeof document === 'undefined') return null;
    return createPortal(modalContent, document.body);
};
