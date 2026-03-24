'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { supabase } from '@/supabaseClient';
import toast from 'react-hot-toast';
import {
    FaDoorOpen,
    FaClock,
    FaBroom,
    FaUtensils,
    FaBoxOpen,
    FaSignOutAlt,
    FaSearch,
    FaTimes,
    FaCheck
} from 'react-icons/fa';
import { Student } from '@/components/student/types';

interface MorningCheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialSelectedStudentIds?: string[];
    roomNumber?: number;
}

const VIOLATION_TYPES = [
    { id: '스토퍼 미설치', icon: FaDoorOpen, color: 'amber', point: 1 },
    { id: '일과시간 미준수', icon: FaClock, color: 'orange', point: 2 },
    { id: '청소불량', icon: FaBroom, color: 'green', point: 1 },
    { id: '음식물 섭취 위반', icon: FaUtensils, color: 'red', point: 3 },
    { id: '박스 방치', icon: FaBoxOpen, color: 'blue', point: 1 },
    { id: '퇴실수칙 불이행', icon: FaSignOutAlt, color: 'purple', point: 2 },
] as const;

type ViolationId = typeof VIOLATION_TYPES[number]['id'];

const COLOR_MAP: Record<string, { tab: string; active: string; badge: string; btn: string; header: string; text: string; shadow: string }> = {
    amber: {
        tab: 'bg-amber-50 border-amber-200 text-amber-700',
        active: 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-200',
        badge: 'bg-amber-100 text-amber-700',
        btn: 'bg-amber-500 hover:bg-amber-600 shadow-amber-200',
        header: 'bg-amber-50',
        text: 'text-amber-600',
        shadow: 'shadow-amber-100',
    },
    orange: {
        tab: 'bg-orange-50 border-orange-200 text-orange-700',
        active: 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-200',
        badge: 'bg-orange-100 text-orange-700',
        btn: 'bg-orange-500 hover:bg-orange-600 shadow-orange-200',
        header: 'bg-orange-50',
        text: 'text-orange-600',
        shadow: 'shadow-orange-100',
    },
    green: {
        tab: 'bg-green-50 border-green-200 text-green-700',
        active: 'bg-green-500 border-green-500 text-white shadow-md shadow-green-200',
        badge: 'bg-green-100 text-green-700',
        btn: 'bg-green-500 hover:bg-green-600 shadow-green-200',
        header: 'bg-green-50',
        text: 'text-green-600',
        shadow: 'shadow-green-100',
    },
    red: {
        tab: 'bg-red-50 border-red-200 text-red-700',
        active: 'bg-red-500 border-red-500 text-white shadow-md shadow-red-200',
        badge: 'bg-red-100 text-red-700',
        btn: 'bg-red-500 hover:bg-red-600 shadow-red-200',
        header: 'bg-red-50',
        text: 'text-red-600',
        shadow: 'shadow-red-100',
    },
    blue: {
        tab: 'bg-blue-50 border-blue-200 text-blue-700',
        active: 'bg-blue-500 border-blue-500 text-white shadow-md shadow-blue-200',
        badge: 'bg-blue-100 text-blue-700',
        btn: 'bg-blue-500 hover:bg-blue-600 shadow-blue-200',
        header: 'bg-blue-50',
        text: 'text-blue-600',
        shadow: 'shadow-blue-100',
    },
    purple: {
        tab: 'bg-purple-50 border-purple-200 text-purple-700',
        active: 'bg-purple-500 border-purple-500 text-white shadow-md shadow-purple-200',
        badge: 'bg-purple-100 text-purple-700',
        btn: 'bg-purple-500 hover:bg-purple-600 shadow-purple-200',
        header: 'bg-purple-50',
        text: 'text-purple-600',
        shadow: 'shadow-purple-100',
    },
};

export const MorningCheckoutModal: React.FC<MorningCheckoutModalProps> = ({
    isOpen,
    onClose,
    initialSelectedStudentIds,
    roomNumber
}) => {
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedViolation, setSelectedViolation] = useState<ViolationId>('스토퍼 미설치');
    const [checkDate, setCheckDate] = useState(new Date().toISOString().split('T')[0]);

    const activeViolation = VIOLATION_TYPES.find(v => v.id === selectedViolation)!;
    const colors = COLOR_MAP[activeViolation.color];

    useEffect(() => {
        if (isOpen) {
            fetchStudents();
            setSearchTerm('');
            setSelectedStudentIds(initialSelectedStudentIds || []);
            setCheckDate(new Date().toISOString().split('T')[0]);
            setSelectedViolation('스토퍼 미설치');
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, initialSelectedStudentIds]);

    // 위반 유형 변경 시 학생 선택 초기화 (방 번호가 없을 때만)
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
            return matchesSearch && (s.room_number === roomNumber || s.room === roomNumber);
        }
        return matchesSearch;
    });

    const handleSave = async () => {
        if (selectedStudentIds.length === 0) return toast.error('선택된 학생이 없습니다.');
        if (!confirm(`${selectedStudentIds.length}명의 학생을 '${selectedViolation}'으로 저장하시겠습니까?`)) return;

        setIsSaving(true);
        try {
            const timestamp = new Date(checkDate);
            const now = new Date();
            timestamp.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

            const payload = selectedStudentIds.map(id => ({
                student_id: id,
                type: 'late',
                teacher_id: localStorage.getItem('dormichan_login_id') || 'teacher',
                note: selectedViolation,
                checked_at: timestamp.toISOString()
            }));

            const { error } = await supabase.from('morning_checks').insert(payload);

            if (error) throw error;

            toast.success(`${selectedStudentIds.length}명 저장되었습니다.`);
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
                <div className="fixed inset-0 z-[9999] flex items-end sm:items-start justify-center sm:p-4 sm:pt-10">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ y: "100%", opacity: 0, scale: 0.95 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: "100%", opacity: 0, scale: 0.95 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative bg-white w-full sm:max-w-2xl rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[88vh] overflow-hidden"
                    >
                        {/* Header */}
                        <div className={clsx("px-6 py-4 text-white flex justify-between items-center transition-colors duration-300", colors.active)}>
                            <div className="flex flex-col gap-0">
                                {roomNumber && (
                                    <span className="text-3xl font-black mb-0.5 drop-shadow-xs">
                                        {roomNumber}호
                                    </span>
                                )}
                                <h2 className="text-base font-bold flex items-center gap-1.5 opacity-90">
                                    <activeViolation.icon />
                                    <span>{activeViolation.id}</span>
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2.5 hover:bg-black/10 rounded-full transition-colors flex items-center justify-center bg-white/10"
                            >
                                <FaTimes size={24} />
                            </button>
                        </div>

                        {/* Violation Types Tab */}
                        <div className="px-4 py-2 border-b border-gray-100 bg-white">
                            <p className="text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider px-1">위반 유형 선택</p>
                            <div className="grid grid-cols-6 gap-1">
                                {VIOLATION_TYPES.map(v => {
                                    const isActive = selectedViolation === v.id;
                                    const c = COLOR_MAP[v.color];
                                    return (
                                        <button
                                            key={v.id}
                                            onClick={() => setSelectedViolation(v.id)}
                                            className={clsx(
                                                'flex flex-col items-center justify-center gap-0.5 p-1 rounded-xl border text-[9px] font-bold transition-all duration-200 min-h-[52px]',
                                                isActive ? c.active : `bg-white border-gray-100 text-gray-500 hover:${c.tab}`
                                            )}
                                        >
                                            <v.icon className="text-base" />
                                            <span className="leading-tight text-center whitespace-pre-wrap break-keep">{v.id.replace(' ', '\n')}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Date & Search Controls */}
                        <div className="p-4 flex flex-col gap-3 bg-white border-b border-gray-100">
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:border-gray-400"
                                    value={checkDate}
                                    onChange={e => setCheckDate(e.target.value)}
                                />
                                {!roomNumber && (
                                    <div className="relative flex-1">
                                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input
                                            type="text"
                                            placeholder="이름/학번 검색..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 transition-colors"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Selection Tools */}
                        {!roomNumber && (
                            <div className="px-6 py-2 border-b border-gray-100 flex gap-2">
                                <button
                                    onClick={() => setSelectedStudentIds(filteredStudents.map(s => s.student_id))}
                                    className="px-3 py-1 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                                >
                                    전체 선택
                                </button>
                                <button
                                    onClick={() => setSelectedStudentIds([])}
                                    className="px-3 py-1 text-xs font-bold text-gray-500 bg-gray-50 rounded-lg hover:bg-gray-100"
                                >
                                    해제
                                </button>
                            </div>
                        )}

                        {/* Student List */}
                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                            {isLoading ? (
                                <div className="flex justify-center py-10">
                                    <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                                </div>
                            ) : (
                                <div className={clsx(
                                    "grid gap-2",
                                    roomNumber ? "grid-cols-2 gap-3" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2"
                                )}>
                                    {filteredStudents.map((student, sIdx) => {
                                        const isSelected = selectedStudentIds.includes(student.student_id);
                                        return (
                                            <button
                                                key={student.student_id || `student-select-${sIdx}`}
                                                onClick={() => toggleSelection(student.student_id)}
                                                className={clsx(
                                                    "border text-left transition-all relative overflow-hidden group flex flex-col justify-center",
                                                    roomNumber
                                                        ? "p-5 rounded-2xl min-h-[100px]"
                                                        : "p-3 rounded-xl min-h-[64px]",
                                                    isSelected
                                                        ? `border-2 bg-white ${colors.shadow} shadow-md ${roomNumber ? 'scale-[1.02]' : 'scale-[1.01]'}`
                                                        : "bg-white border-gray-100 hover:border-gray-200"
                                                )}
                                                style={isSelected ? { borderColor: activeViolation.color === 'amber' ? '#f59e0b' : activeViolation.color === 'orange' ? '#f97316' : activeViolation.color === 'green' ? '#22c55e' : activeViolation.color === 'red' ? '#ef4444' : '#3b82f6' } : {}}
                                            >
                                                <div className="flex justify-between items-center w-full">
                                                    <div>
                                                        <span className={clsx("font-bold block tracking-tighter", roomNumber ? "text-xs mb-1" : "text-[8px] mb-0.5", isSelected ? colors.text : "text-gray-400")}>{student.student_id}</span>
                                                        <span className={clsx("font-black block leading-none", roomNumber ? "text-2xl" : "text-base", isSelected ? "text-gray-900" : "text-gray-700")}>{student.name}</span>
                                                    </div>
                                                    <div className={clsx("rounded-full border flex items-center justify-center transition-colors flex-shrink-0",
                                                        roomNumber ? "w-8 h-8 border-2" : "w-5 h-5 border-2",
                                                        isSelected ? "border-white bg-white/20" : "border-gray-200 bg-gray-50")}
                                                        style={isSelected ? { backgroundColor: 'white', borderColor: 'transparent' } : {}}
                                                    >
                                                        {isSelected && <FaCheck size={roomNumber ? 16 : 10} style={{ color: activeViolation.color === 'amber' ? '#f59e0b' : activeViolation.color === 'orange' ? '#f97316' : activeViolation.color === 'green' ? '#22c55e' : activeViolation.color === 'red' ? '#ef4444' : '#3b82f6' }} />}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 bg-white flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                            <button
                                onClick={onClose}
                                className="px-5 py-2 bg-gray-100 text-gray-500 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm"
                            >
                                닫기
                            </button>
                            <div className="flex items-center gap-3">
                                <div className="text-sm font-bold text-gray-600 flex items-center gap-1">
                                    <span className={`text-lg font-extrabold ${colors.text}`}>{selectedStudentIds.length}</span>
                                    <span>명 선택</span>
                                </div>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving || selectedStudentIds.length === 0}
                                    className={clsx(
                                        "px-6 py-2 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none text-sm",
                                        colors.btn
                                    )}
                                >
                                    {isSaving ? '저장 중...' : '저장하기'}
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
