'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/supabaseClient';
import toast from 'react-hot-toast';
import { FaSearch, FaTrash, FaClock, FaEdit } from 'react-icons/fa';

interface SpecialNotesModalProps {
    isOpen: boolean;
    onClose: () => void;
    logType: 'late' | 'yanghyeonjae';
    selectedDate?: Date;
    readOnly?: boolean;
    onUpdate?: () => void;
}

interface SpecialNoteItem {
    id: string | number;
    student_id: string;
    teacher_id?: string;
    note: string;
    checked_at: string;
    type?: string;
}

export const SpecialNotesModal: React.FC<SpecialNotesModalProps> = ({
    isOpen,
    onClose,
    logType,
    selectedDate,
    readOnly = false,
    onUpdate
}) => {
    const [notes, setNotes] = useState<SpecialNoteItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = selectedDate ? new Date(selectedDate) : new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [editingId, setEditingId] = useState<string | number | null>(null);
    const [editingNote, setEditingNote] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            fetchMonthlyNotes();
        } else {
            setEditingId(null);
            setEditingNote('');
            document.body.style.overflow = 'unset';
        }
    }, [isOpen, selectedMonth, logType]);

    const fetchMonthlyNotes = async () => {
        setIsLoading(true);
        try {
            const [year, month] = selectedMonth.split('-').map(Number);
            const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
            const end = new Date(year, month, 0, 23, 59, 59, 999);

            let query = supabase
                .from('morning_checks')
                .select('*')
                .eq('student_id', '특이사항')
                .gte('checked_at', start.toISOString())
                .lte('checked_at', end.toISOString())
                .order('checked_at', { ascending: false });

            if (logType === 'yanghyeonjae') {
                query = query.eq('type', 'yanghyeonjae');
            } else {
                query = query.or('type.eq.late,type.is.null');
            }

            const { data, error } = await query;
            if (error) throw error;
            setNotes(data || []);
        } catch (err) {
            console.error('Error fetching monthly special notes:', err);
            toast.error('월간 특이사항을 불러오지 못했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string | number) => {
        if (!window.confirm('이 특이사항 기록을 삭제하시겠습니까?')) return;
        setNotes(prev => prev.filter(n => n.id !== id));
        try {
            const { error } = await supabase
                .from('morning_checks')
                .delete()
                .eq('id', id);
            if (error) throw error;
            toast.success('특이사항이 삭제되었습니다.');
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error(err);
            toast.error('삭제에 실패했습니다.');
            fetchMonthlyNotes();
        }
    };

    const handleUpdate = async (id: string | number) => {
        const trimmed = editingNote.trim();
        if (!trimmed) {
            toast.error('내용을 입력해주세요.');
            return;
        }
        setIsSavingEdit(true);
        try {
            const { error } = await supabase
                .from('morning_checks')
                .update({ note: trimmed })
                .eq('id', id);
            if (error) throw error;
            toast.success('특이사항이 수정되었습니다.');
            setNotes(prev => prev.map(n => n.id === id ? { ...n, note: trimmed } : n));
            setEditingId(null);
            setEditingNote('');
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error(err);
            toast.error('수정에 실패했습니다.');
        } finally {
            setIsSavingEdit(false);
        }
    };

    const filtered = notes.filter(item => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return true;
        return (
            (item.note && item.note.toLowerCase().includes(q)) ||
            (item.teacher_id && item.teacher_id.toLowerCase().includes(q))
        );
    });

    if (!mounted) return null;

    const titleLabel = logType === 'yanghyeonjae' ? '양현재 월간 특이사항' : '홍지관 월간 특이사항';

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key={`special-notes-modal-${logType}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-[9999] flex items-center justify-center p-3 sm:p-4"
                >
                    <motion.div
                        initial={{ scale: 0.98, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.98, opacity: 0, y: 10 }}
                        onClick={e => e.stopPropagation()}
                        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col h-[82vh] sm:h-[78vh] min-h-[420px] max-h-[90vh] overflow-hidden border border-gray-100"
                    >
                        {/* Header */}
                        <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 bg-gray-50/70 border-b border-gray-100 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-base sm:text-lg font-black text-gray-900 leading-none">
                                            {titleLabel}
                                        </h2>
                                        <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-yellow-100 text-yellow-900 border border-yellow-300">
                                            {filtered.length}건
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-400 font-bold mt-1">
                                        {selectedMonth.replace('-', '년 ')}월 특이사항 및 건의사항 기록
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="bg-white border border-gray-200 rounded-xl px-2.5 py-1 text-xs font-bold text-gray-700 outline-none shadow-2xs cursor-pointer"
                                />
                                <button
                                    onClick={onClose}
                                    className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-all cursor-pointer border border-gray-200 shadow-2xs font-bold"
                                    aria-label="닫기"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="px-5 py-3 border-b border-gray-100 bg-white shrink-0">
                            <div className="relative">
                                <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                                <input
                                    type="text"
                                    placeholder="특이사항 내용 또는 작성 교사 검색..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3.5 py-2 text-xs font-semibold text-gray-800 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-gray-400 transition-colors"
                                />
                            </div>
                        </div>

                        {/* Cards List */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50/40 space-y-2.5">
                            {isLoading ? (
                                <div className="py-16 flex flex-col items-center justify-center gap-2 text-gray-400">
                                    <div className="w-6 h-6 border-2 border-gray-800 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-xs font-semibold">특이사항 내역을 불러오는 중...</span>
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="py-16 flex flex-col items-center justify-center text-center text-gray-400">
                                    <p className="text-xs font-bold text-gray-500">해당 월에 등록된 특이사항이 없습니다.</p>
                                </div>
                            ) : (
                                filtered.map((item) => {
                                    const isEditing = editingId === item.id;
                                    const dt = item.checked_at ? new Date(item.checked_at) : null;
                                    const dateTimeStr = dt
                                        ? `${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')} ${dt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}`
                                        : '';

                                    return (
                                        <div
                                            key={item.id}
                                            className="bg-white border border-gray-200/90 rounded-2xl p-3.5 shadow-2xs flex flex-col gap-2 transition-all hover:border-gray-300"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-yellow-100 text-yellow-900 border border-yellow-300">
                                                        특이사항
                                                    </span>
                                                    {dateTimeStr && (
                                                        <span className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
                                                            <FaClock size={10} />
                                                            {dateTimeStr} 기록
                                                        </span>
                                                    )}
                                                    {item.teacher_id && (
                                                        <span className="text-slate-600 font-bold bg-slate-100 border border-slate-200/70 px-1.5 py-0.5 rounded text-[10px]">
                                                            작성 : {item.teacher_id}
                                                        </span>
                                                    )}
                                                </div>

                                                {!readOnly && !isEditing && (
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingId(item.id);
                                                                setEditingNote(item.note);
                                                            }}
                                                            className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-700 border border-gray-200 flex items-center justify-center transition-colors cursor-pointer"
                                                            title="수정"
                                                        >
                                                            <FaEdit size={11} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(item.id)}
                                                            className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-rose-50 text-gray-400 hover:text-rose-600 border border-gray-200 flex items-center justify-center transition-colors cursor-pointer"
                                                            title="삭제"
                                                        >
                                                            <FaTrash size={10} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {isEditing ? (
                                                <div className="flex gap-2 items-center pt-1">
                                                    <input
                                                        type="text"
                                                        value={editingNote}
                                                        onChange={e => setEditingNote(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleUpdate(item.id);
                                                        }}
                                                        className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-3 py-1.5 text-xs sm:text-sm text-gray-900 focus:outline-none focus:bg-white"
                                                        autoFocus
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdate(item.id)}
                                                        disabled={isSavingEdit}
                                                        className="px-3 py-1.5 bg-gray-900 text-white rounded-xl text-xs font-bold cursor-pointer"
                                                    >
                                                        저장
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingId(null);
                                                            setEditingNote('');
                                                        }}
                                                        className="px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold cursor-pointer"
                                                    >
                                                        취소
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="text-xs sm:text-sm text-slate-800 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 leading-relaxed break-words font-medium">
                                                    {item.note}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 bg-white border-t border-gray-100 flex items-center justify-end shrink-0">
                            <button
                                onClick={onClose}
                                className="px-5 py-2 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
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

