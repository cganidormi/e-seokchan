'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { supabase } from '@/supabaseClient';
import toast from 'react-hot-toast';
import { FaChartBar, FaSearch, FaClock, FaTrash, FaBed, FaMobileAlt, FaWalking, FaVolumeUp } from 'react-icons/fa';
import { Student } from '@/components/student/types';

interface YanghyeonjaeStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialFilter?: 'today' | 'month';
    selectedDate?: Date;
    readOnly?: boolean;
    onUpdate?: () => void;
}

interface StudentViolationCount extends Student {
    count: number;
    details: any[];
}

const YANGHYEONJAE_ICONS: Record<string, React.ElementType> = {
    '졸음': FaBed,
    '전자기기 위반': FaMobileAlt,
    '무단이석': FaWalking,
    '지각 입실': FaClock,
    '소란': FaVolumeUp,
    '기타': FaChartBar
};

const YANGHYEONJAE_NOTE_STYLES: Record<string, string> = {
    '졸음': 'bg-blue-50 text-blue-700 border-blue-200/80',
    '전자기기 위반': 'bg-purple-50 text-purple-700 border-purple-200/80',
    '무단이석': 'bg-amber-50 text-amber-700 border-amber-200/80',
    '지각 입실': 'bg-orange-50 text-orange-700 border-orange-200/80',
    '소란': 'bg-rose-50 text-rose-700 border-rose-200/80',
    '기타': 'bg-slate-100 text-slate-700 border-slate-200'
};

const normalizeCategory = (rawNote: string): { category: string; detail: string } => {
    const note = rawNote || '';
    let category = note;
    let detail = '';

    if (note.includes(': ')) {
        const parts = note.split(': ');
        category = parts[0].trim();
        detail = parts.slice(1).join(': ').trim();
    } else if (note.includes(':')) {
        const parts = note.split(':');
        category = parts[0].trim();
        detail = parts.slice(1).join(':').trim();
    }

    if (category === '무단 이석') category = '무단이석';
    if (category === '지각입실') category = '지각 입실';

    if (!YANGHYEONJAE_ICONS[category]) {
        if (category.includes('졸음')) category = '졸음';
        else if (category.includes('전자기기') || category.includes('스마트폰') || category.includes('폰')) category = '전자기기 위반';
        else if (category.includes('이석') || category.includes('자리')) category = '무단이석';
        else if (category.includes('지각')) category = '지각 입실';
        else if (category.includes('소란') || category.includes('대화')) category = '소란';
        else category = '기타';
    }

    return { category, detail };
};

export const YanghyeonjaeStatsModal: React.FC<YanghyeonjaeStatsModalProps> = ({
    isOpen,
    onClose,
    initialFilter = 'today',
    selectedDate,
    readOnly = false,
    onUpdate
}) => {
    const [students, setStudents] = useState<StudentViolationCount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'today' | 'month'>(initialFilter);
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = selectedDate ? new Date(selectedDate) : new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [mounted, setMounted] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<StudentViolationCount | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            if (initialFilter) setFilterType(initialFilter);
            setSelectedStudent(null);
            document.body.style.overflow = 'hidden';
            fetchStats();
        } else if (!document.querySelector('.modal-open')) {
            setSelectedStudent(null);
            const otherModals = document.querySelectorAll('[key*="modal-overlay"]');
            if (otherModals.length <= 1) {
                document.body.style.overflow = 'unset';
            }
        }
    }, [isOpen, selectedMonth, filterType, selectedDate]);

    const fetchStats = async () => {
        setIsLoading(true);
        try {
            const { data: studentsData } = await supabase
                .from('students')
                .select('*')
                .order('student_id');

            let startISO: string, endISO: string;
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

                startISO = start.toISOString();
                endISO = end.toISOString();
            } else {
                const [year, month] = selectedMonth.split('-');
                startISO = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString();
                endISO = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999).toISOString();
            }

            const { data: rawChecks } = await supabase
                .from('morning_checks')
                .select('*')
                .eq('type', 'yanghyeonjae')
                .gte('checked_at', startISO)
                .lte('checked_at', endISO);

            const violationData = (rawChecks || []).map(v => {
                const { category, detail } = normalizeCategory(v.note);
                return {
                    ...v,
                    category,
                    detail,
                    displayNote: category
                };
            });

            if (studentsData) {
                const violationMap = new Map();
                violationData.forEach(v => {
                    const existing = violationMap.get(v.student_id) || [];
                    violationMap.set(v.student_id, [...existing, v]);
                });

                const merged = studentsData
                    .filter(s => !(
                        (s.grade === 3 && s.class === 3 && s.number === 17 && s.name === '홍길동') ||
                        (s.grade === 3 && s.class === 3 && s.number === 18 && s.name === '이순신') ||
                        (s.grade === 1 && s.class === 2 && s.number === 8 && s.name === '이성진') ||
                        s.student_id === '3317홍길동' ||
                        s.student_id === '3318이순신' ||
                        s.student_id === '1208이성진'
                    ))
                    .map(s => {
                        const details = violationMap.get(s.student_id) || [];
                        const sortedDetails = [...details].sort((a, b) => 
                            new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime()
                        );
                        return {
                            ...s,
                            count: details.length,
                            details: sortedDetails
                        };
                    })
                    .filter(s => s.count > 0)
                    .sort((a, b) => {
                        if (b.count !== a.count) return b.count - a.count;
                        return a.student_id.localeCompare(b.student_id);
                    });

                setStudents(merged);
            }
        } catch (error) {
            console.error('Error fetching Yanghyeonjae stats:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteViolation = async (violationId: number) => {
        if (!window.confirm('이 위반 내역을 삭제하시겠습니까?')) return;

        try {
            const { error } = await supabase
                .from('morning_checks')
                .delete()
                .eq('id', violationId);

            if (error) throw error;

            toast.success('위반 내역이 삭제되었습니다.');

            if (selectedStudent) {
                const updatedDetails = selectedStudent.details.filter(d => d.id !== violationId);
                const updatedStudent = {
                    ...selectedStudent,
                    count: updatedDetails.length,
                    details: updatedDetails
                };

                if (updatedStudent.count > 0) {
                    setSelectedStudent(updatedStudent);
                } else {
                    setSelectedStudent(null);
                }

                setStudents(prev =>
                    prev
                        .map(s => s.student_id === selectedStudent.student_id ? updatedStudent : s)
                        .filter(s => s.count > 0)
                );
            }

            if (onUpdate) onUpdate();
        } catch (err: any) {
            console.error('Delete violation error:', err);
            toast.error('삭제 처리 중 오류가 발생했습니다: ' + (err.message || '알 수 없는 오류'));
        }
    };

    const filtered = students.filter(s => 
        s.name.includes(searchTerm) || 
        s.student_id.includes(searchTerm) ||
        String(s.room_number || (s as any).room || '').includes(searchTerm)
    );

    if (!mounted || !isOpen) return null;

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="yanghyeonjae-stats-modal-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[9999] flex items-center justify-center p-2 sm:p-4"
                >
                    <motion.div
                        initial={{ scale: 0.98, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.98, opacity: 0, y: 10 }}
                        className="bg-white w-full max-w-[95vw] lg:max-w-6xl rounded-3xl shadow-2xl flex flex-col h-[85vh] sm:h-[80vh] min-h-[480px] max-h-[92vh] overflow-hidden border border-gray-100"
                    >
                        {/* Compact Header */}
                        <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 bg-gray-50/70 border-b border-gray-100 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-slate-800 rounded-xl shadow-xs shrink-0">
                                    <FaChartBar className="text-white text-sm" />
                                </div>
                                <div>
                                    <h2 className="text-base font-black text-gray-900 leading-none">양현재 일지 통계</h2>
                                    <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                                        {filterType === 'today' ? '오늘의 위반자 명단 (18:00 ~ 익일 09:00)' : `${selectedMonth.replace('-', '년 ')}월 위반자 명단`}
                                    </p>
                                </div>

                                {/* Filter Toggle Tabs */}
                                <div className="flex bg-gray-200/70 p-0.5 rounded-xl border border-gray-200 ml-2">
                                    <button
                                        onClick={() => { setFilterType('today'); setSelectedStudent(null); }}
                                        className={clsx(
                                            "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                            filterType === 'today' ? "bg-gray-900 text-white shadow-xs" : "text-gray-600 hover:text-gray-900"
                                        )}
                                    >
                                        금일 위반
                                    </button>
                                    <button
                                        onClick={() => { setFilterType('month'); setSelectedStudent(null); }}
                                        className={clsx(
                                            "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                            filterType === 'month' ? "bg-gray-900 text-white shadow-xs" : "text-gray-600 hover:text-gray-900"
                                        )}
                                    >
                                        월간 통계
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 flex-grow sm:flex-grow-0 min-w-0">
                                <div className="relative flex-grow sm:w-48">
                                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]" />
                                    <input
                                        type="text"
                                        placeholder="이름/학번/호실..."
                                        className="w-full bg-white border border-gray-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold focus:ring-1 focus:ring-slate-300 focus:border-slate-400 outline-none transition-all placeholder:text-gray-300 text-gray-800"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                {filterType === 'month' && (
                                    <input
                                        type="month"
                                        className="bg-white border border-gray-200 rounded-xl px-2 py-1.5 text-xs font-black text-gray-700 focus:ring-1 focus:ring-slate-300 focus:border-slate-400 outline-none"
                                        value={selectedMonth}
                                        onChange={e => { setSelectedMonth(e.target.value); setSelectedStudent(null); }}
                                    />
                                )}
                                <button 
                                    onClick={onClose} 
                                    className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all text-sm font-bold ml-1 cursor-pointer"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Main Content Area */}
                        <div className="flex-1 min-h-0 bg-white flex flex-col relative overflow-hidden">
                            {selectedStudent ? (
                                /* Chronological Detail View */
                                <div className="flex-1 min-h-0 flex flex-col p-4 sm:p-5 overflow-hidden bg-white">
                                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100 shrink-0 gap-2">
                                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                            <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-sm shrink-0 shadow-xs">
                                                {selectedStudent.name[0]}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-base sm:text-lg font-black text-gray-900 leading-tight truncate">
                                                    {selectedStudent.name} 상세 내역
                                                </h3>
                                                <p className="text-xs text-gray-500 font-bold mt-0.5 flex items-center gap-1.5 flex-wrap">
                                                    <span>
                                                        {selectedStudent.name && selectedStudent.student_id.includes(selectedStudent.name)
                                                            ? selectedStudent.student_id.replace(selectedStudent.name, '').trim() || selectedStudent.student_id
                                                            : selectedStudent.student_id}
                                                    </span>
                                                    {(selectedStudent.room_number || (selectedStudent as any).room) && (
                                                        <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-extrabold text-[10px] border border-blue-100/80 leading-none">
                                                            {(selectedStudent.room_number || (selectedStudent as any).room)}호
                                                        </span>
                                                    )}
                                                    <span className={clsx(
                                                        "px-1.5 py-0.5 rounded font-bold text-[10px] leading-none border",
                                                        selectedStudent.count >= 3
                                                            ? "bg-rose-50 text-rose-700 border-rose-200"
                                                            : selectedStudent.count === 2
                                                            ? "bg-amber-50 text-amber-800 border-amber-200"
                                                            : "bg-slate-100 text-slate-700 border-slate-200"
                                                    )}>
                                                        총 {selectedStudent.count}건
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => setSelectedStudent(null)}
                                            className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-black rounded-xl transition-all text-xs cursor-pointer shrink-0 active:scale-95 flex items-center gap-1 shadow-xs"
                                        >
                                            <span>← 목록으로</span>
                                        </button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 overscroll-contain">
                                        {selectedStudent.details.map((v, vIdx) => {
                                            const Icon = YANGHYEONJAE_ICONS[v.category] || FaChartBar;
                                            const date = new Date(v.checked_at);
                                            const badgeStyle = YANGHYEONJAE_NOTE_STYLES[v.category] || 'bg-slate-100 text-slate-700 border-slate-200';

                                            return (
                                                <motion.div 
                                                    initial={{ opacity: 0, x: -6 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: vIdx * 0.03 }}
                                                    key={v.id || `detail-${vIdx}`} 
                                                    className="flex items-center justify-between bg-white border border-gray-100 hover:border-gray-200 p-3 sm:p-4 rounded-2xl shadow-xs transition-all"
                                                >
                                                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                                        <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border", badgeStyle)}>
                                                            <Icon size={16} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-xs sm:text-sm font-black text-gray-800 truncate leading-snug">
                                                                    {v.category}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                                <span className="text-[10px] sm:text-[11px] text-gray-400 font-semibold">
                                                                    {date.getFullYear()}. {date.getMonth() + 1}. {date.getDate()} ({['일','월','화','수','목','금','토'][date.getDay()]}) {String(date.getHours()).padStart(2, '0')}:{String(date.getMinutes()).padStart(2, '0')} 기록
                                                                </span>
                                                                {v.teacher_id && (
                                                                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200/70 px-1.5 py-0.5 rounded">
                                                                        지도 : {v.teacher_id}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {v.detail && (
                                                                <div className="mt-1.5 text-xs text-slate-700 bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5 leading-relaxed break-words font-medium">
                                                                    {v.detail}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-2">
                                                        {!readOnly && (
                                                            <button
                                                                onClick={() => handleDeleteViolation(v.id)}
                                                                className="px-2.5 py-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all flex items-center gap-1 text-xs font-bold cursor-pointer"
                                                                title="위반 내역 삭제"
                                                            >
                                                                <FaTrash size={12} />
                                                                <span>삭제</span>
                                                            </button>
                                                        )}
                                                        <div className="text-[10px] font-black text-gray-300 w-5 text-right">
                                                            #{vIdx + 1}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                /* High-Density List Grid */
                                <div className="flex-1 overflow-y-auto p-3 sm:p-5 min-h-0 overscroll-contain">
                                    {isLoading ? (
                                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                                            <div className="w-8 h-8 border-3 border-slate-800 border-t-transparent rounded-full animate-spin"></div>
                                            <p className="text-[11px] font-bold text-gray-400">데이터 로딩 중...</p>
                                        </div>
                                    ) : filtered.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-gray-300">
                                            <FaSearch size={32} className="mb-2 opacity-30" />
                                            <p className="text-xs font-bold">위반 학생이 없습니다.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1.5 sm:gap-2">
                                            {filtered.map((student, idx) => {
                                                const isRepeat = student.count >= 3;
                                                const isDouble = student.count === 2;

                                                return (
                                                    <div 
                                                        key={student.student_id || `student-idx-${idx}`} 
                                                        onClick={() => setSelectedStudent(student)}
                                                        className={clsx(
                                                            "relative p-2 rounded-2xl border transition-all group overflow-hidden cursor-pointer active:scale-95 flex flex-col justify-between",
                                                            isRepeat 
                                                                ? "bg-rose-50/40 border-rose-200 hover:bg-rose-50/70 hover:border-rose-300 shadow-2xs" 
                                                                : isDouble
                                                                ? "bg-amber-50/30 border-amber-200/70 hover:bg-white hover:border-amber-300 hover:shadow-2xs"
                                                                : "bg-gray-50/70 border-gray-100 hover:bg-white hover:border-gray-200 hover:shadow-2xs"
                                                        )}
                                                    >
                                                        {/* Top Row: Student ID & Count Badge */}
                                                        <div className="flex items-center justify-between gap-1 mb-1">
                                                            <span className="text-[9px] font-black text-gray-400 leading-none">
                                                                {student.name && student.student_id.includes(student.name)
                                                                    ? student.student_id.replace(student.name, '').trim() || student.student_id
                                                                    : student.student_id}
                                                            </span>
                                                            <span className={clsx(
                                                                "px-1.5 py-0.5 rounded-md text-[9px] font-black leading-none shrink-0",
                                                                isRepeat
                                                                    ? "bg-rose-600 text-white"
                                                                    : isDouble
                                                                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                                                                    : "bg-slate-100 text-slate-700 border border-slate-200"
                                                            )}>
                                                                {student.count}회
                                                            </span>
                                                        </div>

                                                        {/* Name & Room Badge */}
                                                        <div className="mb-1.5 flex items-center justify-between gap-1">
                                                            <span className="text-xs font-black text-gray-800 line-clamp-1">{student.name}</span>
                                                            {(student.room_number || (student as any).room) && (
                                                                <span className="text-[9px] font-extrabold text-blue-600 bg-blue-50 px-1 py-0.5 rounded border border-blue-100/80 leading-none shrink-0">
                                                                    {(student.room_number || (student as any).room)}호
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex flex-wrap gap-1">
                                                            {(() => {
                                                                const counts = student.details.reduce((acc: any, d: any) => {
                                                                    acc[d.category] = (acc[d.category] || 0) + 1;
                                                                    return acc;
                                                                }, {});
                                                                
                                                                return Object.entries(counts).slice(0, 4).map(([category, count], nIdx) => {
                                                                    const Icon = YANGHYEONJAE_ICONS[category as string] || FaChartBar;
                                                                    return (
                                                                        <div 
                                                                            key={nIdx} 
                                                                            title={`${category}: ${count}회`}
                                                                            className="relative w-5 h-5 bg-white rounded-lg flex items-center justify-center text-gray-400 group-hover:text-slate-700 transition-colors border border-gray-100 shadow-2xs"
                                                                        >
                                                                            <Icon size={11} />
                                                                            {(count as number) > 1 && (
                                                                                <span className="absolute -bottom-1 -right-1 bg-gray-900 text-white text-[7px] font-black w-3 h-3 rounded-full flex items-center justify-center ring-1 ring-white">
                                                                                    {count as number}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                });
                                                            })()}
                                                            {Array.from(new Set(student.details.map(d => d.category))).length > 4 && (
                                                                <div className="text-[7px] font-black text-gray-300 self-center ml-0.5">
                                                                    +{Array.from(new Set(student.details.map(d => d.category))).length - 4}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Minimal Footer */}
                        <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-rose-500 shadow-sm"></div>
                                    <span className="text-[10px] font-bold text-gray-500">
                                        관찰 대상 (3회 이상): <span className="text-gray-900 font-black">{students.filter(s => s.count >= 3).length}</span>명
                                    </span>
                                </div>
                                <div className="text-[10px] font-bold text-gray-400 flex items-center gap-3">
                                    <span>총 위반: <span className="text-gray-900 font-black">{students.reduce((acc, s) => acc + s.count, 0)}</span>건</span>
                                    <span className="w-px h-2 bg-gray-200"></span>
                                    <span>전체 인원: <span className="text-gray-900 font-black">{students.length}</span>명</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return createPortal(modalContent, document.body);
};
