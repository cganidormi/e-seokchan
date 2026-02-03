'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { supabase } from '@/supabaseClient';

import { Student } from '@/components/student/types';

interface StudentSelectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (student: Student) => void;
    currentStudentName?: string; // If replacing
    assignedStudentIds?: string[];
}

export const StudentSelectModal: React.FC<StudentSelectModalProps> = ({
    isOpen,
    onClose,
    onSelect,
    currentStudentName,
    assignedStudentIds = []
}) => {
    const [students, setStudents] = useState<Student[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchStudents();
            setSearchTerm('');
        }
    }, [isOpen]);

    const fetchStudents = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('students')
            .select('*')
            .order('name');

        if (data) {
            setStudents(data);
        }
        setIsLoading(false);
    };

    const filteredStudents = students.filter(s =>
        (s.name.includes(searchTerm) || s.student_id.includes(searchTerm)) &&
        !assignedStudentIds.includes(s.student_id)
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#1c1c1e] w-full max-w-md rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[80vh]"
                        >
                            <div className="p-4 border-b border-white/10 flex justify-between items-center">
                                <h3 className="text-lg font-bold text-white">학생 선택</h3>
                                <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
                            </div>

                            <div className="p-4">
                                <input
                                    type="text"
                                    placeholder="이름 또는 학번 검색..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
                                    autoFocus
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                {isLoading ? (
                                    <div className="text-center py-8 text-gray-500">로딩 중...</div>
                                ) : (
                                    filteredStudents.map(student => (
                                        <button
                                            key={student.student_id}
                                            onClick={() => onSelect(student)}
                                            className="w-full text-left px-4 py-3 rounded-xl hover:bg-white/5 flex justify-between items-center group transition-colors"
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-white font-medium">{student.student_id}</span>
                                            </div>
                                            <span className="text-orange-500 transition-opacity">선택</span>
                                        </button>
                                    ))
                                )}
                                {!isLoading && filteredStudents.length === 0 && (
                                    <div className="text-center py-8 text-gray-500">검색 결과가 없습니다.</div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
