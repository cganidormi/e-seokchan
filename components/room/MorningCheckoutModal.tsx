'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { supabase } from '@/supabaseClient';
import toast from 'react-hot-toast';
import { Student } from '@/components/student/types';

interface MorningCheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const MorningCheckoutModal: React.FC<MorningCheckoutModalProps> = ({
    isOpen,
    onClose
}) => {
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);



    useEffect(() => {
        if (isOpen) {
            fetchStudents();
            setSearchTerm('');
            setSelectedStudentIds([]);
        }
    }, [isOpen]);

    const fetchStudents = async () => {
        setIsLoading(true);
        const { data } = await supabase.from('students').select('*').order('student_id');
        if (data) setStudents(data);
        setIsLoading(false);
    };

    // Filter Logic
    const filteredStudents = students.filter(s => {
        // 1. Text Search
        if (searchTerm) {
            return s.name.includes(searchTerm) || s.student_id.includes(searchTerm);
        }
        return true;
    });

    const toggleSelection = (id: string) => {
        setSelectedStudentIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleSelectAllFiltered = () => {
        const ids = filteredStudents.map(s => s.student_id);
        // Add all filtered IDs to selection (deduplicate)
        setSelectedStudentIds(prev => Array.from(new Set([...prev, ...ids])));
        toast.success(`${ids.length}명 선택됨`);
    };

    const handleSave = async () => {
        if (selectedStudentIds.length === 0) return toast.error('선택된 학생이 없습니다.');
        if (!confirm(`${selectedStudentIds.length}명의 학생을 '일과시간 미준수'로 저장하시겠습니까?`)) return;

        setIsSaving(true);
        try {
            const today = new Date().toISOString().split('T')[0];

            // Checks for duplicates (if needed in future)
            const payload = selectedStudentIds.map(id => ({
                student_id: id,
                type: 'late',
                teacher_id: localStorage.getItem('dormichan_login_id') || 'teacher',
                note: '일과시간 미준수'
            }));

            const { error } = await supabase.from('morning_checks').insert(payload);

            if (error) {
                // If table doesn't exist, this will fail. Warning the user.
                console.error(error);
                throw error;
            }

            toast.success('저장되었습니다.');
            onClose();
        } catch (err: any) {
            toast.error('저장 실패 (DB 확인 필요)');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-orange-50">
                            <div>
                                <h2 className="text-xl font-extrabold text-orange-600 flex items-center gap-2">
                                    일과시간 미준수지도
                                </h2>
                                <p className="text-xs text-orange-400 mt-1">지침 미준수 학생을 선택하여 기록하세요.</p>
                            </div>
                            <button onClick={onClose} className="p-2 bg-white rounded-full text-gray-400 hover:text-gray-600 shadow-sm transition-colors">✕</button>
                        </div>

                        {/* Controls */}
                        <div className="p-4 flex flex-col gap-3 bg-white border-b border-gray-100">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="이름/학번 검색..."
                                    value={searchTerm}
                                    onChange={(e) => { setSearchTerm(e.target.value); }}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-orange-400 transition-colors"
                                />
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                            {isLoading ? (
                                <div className="flex justify-center py-10"><div className="animate-spin text-2xl">⏳</div></div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {filteredStudents.map(student => {
                                        const isSelected = selectedStudentIds.includes(student.student_id);
                                        return (
                                            <button
                                                key={student.student_id}
                                                onClick={() => toggleSelection(student.student_id)}
                                                className={clsx(
                                                    "p-3 rounded-xl border text-left transition-all relative overflow-hidden group",
                                                    isSelected
                                                        ? "bg-orange-50 border-orange-200 shadow-sm"
                                                        : "bg-white border-gray-100 hover:border-orange-100"
                                                )}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <span className={clsx("text-xs font-bold block mb-0.5", isSelected ? "text-orange-600" : "text-gray-400")}>{student.student_id}</span>
                                                        <span className={clsx("text-sm font-bold block", isSelected ? "text-gray-900" : "text-gray-700")}>{student.name}</span>
                                                    </div>
                                                    <div className={clsx("w-5 h-5 rounded-full border flex items-center justify-center transition-colors", isSelected ? "bg-orange-500 border-orange-500" : "border-gray-200 bg-gray-50")}>
                                                        {isSelected && <span className="text-white text-[10px]">✓</span>}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-100 bg-white flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                            <div className="text-sm font-bold text-gray-600">
                                <span className="text-orange-600 text-lg mr-1">{selectedStudentIds.length}</span>명 선택됨
                            </div>
                            <button
                                onClick={handleSave}
                                disabled={isSaving || selectedStudentIds.length === 0}
                                className="px-8 py-3 bg-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-200 hover:bg-orange-600 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none"
                            >
                                {isSaving ? '저장 중...' : '저장하기'}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
