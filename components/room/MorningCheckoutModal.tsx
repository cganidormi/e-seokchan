'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { supabase } from '@/supabaseClient';
import toast from 'react-hot-toast';
import { FaSearch, FaCheck } from 'react-icons/fa';
import { Student } from '@/components/student/types';

interface MorningCheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialSelectedStudentIds?: string[];
    roomNumber?: number;
}

const VIOLATION_TYPES = [
    { id: '스토퍼 미설치', point: 1 },
    { id: '퇴실수칙 불이행', point: 2 },
    { id: '일과시간 미준수', point: 2 },
    { id: '호실이동', point: 2 },
    { id: '청소불량', point: 1 },
    { id: '박스 방치', point: 1 },
    { id: '음식물 섭취 위반', point: 3 },
] as const;

type ViolationId = typeof VIOLATION_TYPES[number]['id'];

export const MorningCheckoutModal: React.FC<MorningCheckoutModalProps> = ({
    isOpen,
    onClose,
    initialSelectedStudentIds,
    roomNumber
}) => {
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const getLocalDateString = (date = new Date()) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedViolation, setSelectedViolation] = useState<ViolationId>('스토퍼 미설치');
    const [checkDate, setCheckDate] = useState(() => getLocalDateString());

    useEffect(() => {
        if (isOpen) {
            fetchStudents();
            setSearchTerm('');
            setSelectedStudentIds(initialSelectedStudentIds || []);
            setCheckDate(getLocalDateString());
            setSelectedViolation('스토퍼 미설치');
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, initialSelectedStudentIds]);

    // 위반 유형 변경 시 방 번호가 없을 때만 선택 초기화
    useEffect(() => {
        if (!roomNumber) {
            setSelectedStudentIds([]);
            setSearchTerm('');
        }
    }, [selectedViolation, roomNumber]);

    const fetchStudents = async () => {
        setIsLoading(true);
        try {
            const { data } = await supabase.from('students').select('*').order('student_id');
            if (data) setStudents(data);
        } catch (e) {
            toast.error('학생 정보를 불러오지 못했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedStudentIds(prev =>
            prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
        );
    };

    const filteredStudents = students.filter(s => {
        const matchesSearch = s.name.includes(searchTerm) || s.student_id.includes(searchTerm);
        if (roomNumber) {
            return matchesSearch && (s.room_number === roomNumber || (s as any).room === roomNumber);
        }
        return matchesSearch;
    });

    const handleSave = async () => {
        if (selectedStudentIds.length === 0) return toast.error('선택된 학생이 없습니다.');
        if (!confirm(`${selectedStudentIds.length}명의 학생을 '${selectedViolation}'으로 저장하시겠습니까?`)) return;

        setIsSaving(true);
        try {
            const [y, m, d] = checkDate.split('-').map(Number);
            const now = new Date();
            const timestamp = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());

            const payload = selectedStudentIds.map(id => ({
                student_id: id,
                type: 'late',
                teacher_id: localStorage.getItem('dormichan_login_id') || 'teacher',
                note: selectedViolation,
                checked_at: timestamp.toISOString()
            }));

            const { error } = await supabase.from('morning_checks').insert(payload);

            if (error) throw error;

            toast.success(`${selectedStudentIds.length}명 위반 기록이 저장되었습니다.`);
            onClose();
        } catch (err: any) {
            toast.error('저장 실패 (DB 확인 필요)');
        } finally {
            setIsSaving(false);
        }
    };

    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ scale: 0.97, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.97, opacity: 0, y: 10 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-100"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Elegant Header */}
                        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                {roomNumber ? (
                                    <div className="px-3 py-1 rounded-xl bg-white/10 border border-white/20 text-white font-black text-sm tracking-tight shrink-0">
                                        {roomNumber}호
                                    </div>
                                ) : (
                                    <div className="w-2.5 h-2.5 rounded-full bg-blue-400 shrink-0" />
                                )}
                                <div>
                                    <h2 className="text-base font-extrabold text-white leading-tight">
                                        생활규정 위반 체크
                                    </h2>
                                    <p className="text-[11px] text-slate-300 font-medium mt-0.5">
                                        위반 유형 및 대상 학생을 선택해 주세요
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all text-sm font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Violation Type Segment Selector (No Childish Icons) */}
                        <div className="px-5 py-3.5 bg-slate-50/70 border-b border-gray-100 shrink-0">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                                    위반 유형
                                </span>
                                <span className="text-[11px] font-bold text-slate-700">
                                    선택: <span className="text-blue-600 font-extrabold">{selectedViolation}</span>
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {VIOLATION_TYPES.map(v => {
                                    const isSelected = selectedViolation === v.id;
                                    return (
                                        <button
                                            key={v.id}
                                            onClick={() => setSelectedViolation(v.id)}
                                            className={clsx(
                                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer active:scale-95",
                                                isSelected
                                                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                                                    : "bg-white text-slate-700 border-gray-200 hover:bg-slate-100 hover:text-slate-900"
                                            )}
                                        >
                                            {v.id}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Date and Search Bar */}
                        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2.5 bg-white shrink-0">
                            <input
                                type="date"
                                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-slate-400 shrink-0"
                                value={checkDate}
                                onChange={e => setCheckDate(e.target.value)}
                            />
                            {!roomNumber && (
                                <div className="relative flex-1">
                                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                                    <input
                                        type="text"
                                        placeholder="이름 또는 학번 검색..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-slate-400 transition-all"
                                    />
                                </div>
                            )}
                            {!roomNumber && (
                                <div className="flex gap-1 shrink-0">
                                    <button
                                        onClick={() => setSelectedStudentIds(filteredStudents.map(s => s.student_id))}
                                        className="px-2.5 py-1.5 text-[11px] font-bold text-slate-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                                    >
                                        전체
                                    </button>
                                    <button
                                        onClick={() => setSelectedStudentIds([])}
                                        className="px-2.5 py-1.5 text-[11px] font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                                    >
                                        해제
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Student List Area */}
                        <div className="flex-1 overflow-y-auto p-5 bg-slate-50/40 min-h-[160px]">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
                                    <div className="w-7 h-7 border-2 border-slate-800 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-xs font-semibold">학생 정보를 불러오는 중...</span>
                                </div>
                            ) : filteredStudents.length === 0 ? (
                                <div className="py-12 flex flex-col items-center justify-center text-center text-gray-400">
                                    <p className="text-xs font-bold text-gray-500">배정되거나 검색된 학생이 없습니다.</p>
                                </div>
                            ) : (
                                <div className={clsx(
                                    "grid gap-2.5",
                                    roomNumber ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"
                                )}>
                                    {filteredStudents.map((student, sIdx) => {
                                        const isSelected = selectedStudentIds.includes(student.student_id);
                                        return (
                                            <button
                                                key={student.student_id || `student-select-${sIdx}`}
                                                type="button"
                                                onClick={() => toggleSelection(student.student_id)}
                                                className={clsx(
                                                    "p-3.5 rounded-2xl border text-left transition-all duration-150 cursor-pointer relative overflow-hidden flex flex-col justify-between active:scale-[0.98]",
                                                    isSelected
                                                        ? "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-900/10"
                                                        : "bg-white border-gray-200/90 text-gray-800 hover:border-gray-300 hover:bg-white"
                                                )}
                                            >
                                                <div className="flex items-start justify-between gap-1 w-full">
                                                    <span className={clsx(
                                                        "text-[10px] font-bold font-mono tracking-tight",
                                                        isSelected ? "text-slate-300" : "text-gray-400"
                                                    )}>
                                                        {student.student_id}
                                                    </span>
                                                    <div className={clsx(
                                                        "w-5 h-5 rounded-lg flex items-center justify-center transition-all shrink-0",
                                                        isSelected
                                                            ? "bg-white text-slate-900"
                                                            : "border border-gray-200 bg-gray-50 text-transparent"
                                                    )}>
                                                        <FaCheck size={9} />
                                                    </div>
                                                </div>

                                                <div className="mt-2 flex items-baseline justify-between w-full">
                                                    <span className={clsx(
                                                        "text-base sm:text-lg font-black leading-tight",
                                                        isSelected ? "text-white" : "text-gray-900"
                                                    )}>
                                                        {student.name}
                                                    </span>
                                                    {(student.room_number || (student as any).room) && !roomNumber && (
                                                        <span className={clsx(
                                                            "text-[10px] font-extrabold px-1.5 py-0.5 rounded",
                                                            isSelected ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                                                        )}>
                                                            {(student.room_number || (student as any).room)}호
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Refined Footer */}
                        <div className="px-5 py-3.5 bg-white border-t border-gray-100 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-gray-500">선택된 대상:</span>
                                <span className={clsx(
                                    "px-2 py-0.5 rounded-lg text-xs font-black",
                                    selectedStudentIds.length > 0
                                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                                        : "bg-gray-100 text-gray-400"
                                )}>
                                    {selectedStudentIds.length}명
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all text-xs cursor-pointer"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving || selectedStudentIds.length === 0}
                                    className="px-5 py-2 bg-slate-900 hover:bg-black text-white font-black rounded-xl transition-all text-xs cursor-pointer shadow-xs active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                                >
                                    {isSaving ? '저장 중...' : '위반 기록 저장'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    if (!mounted || typeof document === 'undefined') return null;
    return createPortal(modalContent, document.body);
};
