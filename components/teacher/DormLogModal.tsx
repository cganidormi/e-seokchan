'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/supabaseClient';
import toast from 'react-hot-toast';
import { FaSearch, FaTrash, FaEdit, FaTimes } from 'react-icons/fa';
import { Student } from '@/components/student/types';

interface DormLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    students?: Student[];
    teacherName?: string;
    initialSelectedStudentIds?: string[];
    roomNumber?: number; hideViolationCheck?: boolean;
}

interface HongjigwanLog {
    id: string | number;
    student_id: string;
    teacher_id: string;
    note: string;
    checked_at: string;
}

const VIOLATION_TYPES = [
    '스토퍼 미설치',
    '퇴실수칙 불이행',
    '일과시간 미준수',
    '호실이동',
    '청소불량',
    '박스 방치',
    '음식물 섭취 위반',
] as const;

export default function DormLogModal({
    isOpen,
    onClose,
    students: propStudents = [],
    teacherName = '',
    initialSelectedStudentIds = [],
    roomNumber, hideViolationCheck = false
}: DormLogModalProps) {
    const [allStudents, setAllStudents] = useState<Student[]>(propStudents);

    // [섹션 1] 생활규정 위반 체크 (학생지도) 상태
    const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
    const [studentSearch, setStudentSearch] = useState('');
    const [isSearchingStudent, setIsSearchingStudent] = useState(false);
    const [selectedViolation, setSelectedViolation] = useState<string | null>(null);
    const [isSubmittingViolation, setIsSubmittingViolation] = useState(false);

    // [섹션 2] 특이사항 상태
    const [specialNote, setSpecialNote] = useState('');
    const [isSubmittingSpecialNote, setIsSubmittingSpecialNote] = useState(false);

    // [섹션 3] 오늘 등록 내역 상태
    const [todayLogs, setTodayLogs] = useState<HongjigwanLog[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

    const [editingLogId, setEditingLogId] = useState<string | number | null>(null);
    const [editingLogNote, setEditingLogNote] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    useEffect(() => {
        if (propStudents && propStudents.length > 0) {
            setAllStudents(propStudents);
        }
    }, [propStudents]);

    const studentMap = useMemo(() => {
        const map = new Map<string, Student>();
        allStudents.forEach(s => map.set(s.student_id, s));
        return map;
    }, [allStudents]);

    // 검색어로 학번, 이름, 호실번호(예: 301) 모두 검색 지원
    const filteredStudents = useMemo(() => {
        const query = studentSearch.trim().toLowerCase();
        if (!query) return [];
        return allStudents
            .filter(s => {
                const roomStr = String(s.room_number || (s as any).room || '');
                return (
                    s.student_id.toLowerCase().includes(query) ||
                    s.name.toLowerCase().includes(query) ||
                    (roomStr && roomStr.includes(query))
                );
            })
            .slice(0, 8);
    }, [allStudents, studentSearch]);

    useEffect(() => {
        if (isOpen) {
            if (allStudents.length === 0) {
                supabase
                    .from('students')
                    .select('*')
                    .order('student_id')
                    .then(({ data }) => {
                        if (data) setAllStudents(data);
                    });
            }
            if (initialSelectedStudentIds && initialSelectedStudentIds.length > 0 && allStudents.length > 0) {
                const preselected = allStudents.filter(s => initialSelectedStudentIds.includes(s.student_id));
                setSelectedStudents(preselected);
            }
            fetchTodayLogs();
        } else {
            setSelectedStudents([]);
            setStudentSearch('');
            setIsSearchingStudent(false);
            setSelectedViolation(null);
            setSpecialNote('');
            setEditingLogId(null);
            setEditingLogNote('');
        }
    }, [isOpen]);

    const getRollcallStartTime = () => {
        const now = new Date();
        return now.getHours() < 18
            ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 18, 0, 0, 0)
            : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0, 0);
    };

    const fetchTodayLogs = async () => {
        setIsLoadingLogs(true);
        try {
            const rollcallStart = getRollcallStartTime();

            const { data, error } = await supabase
                .from('morning_checks')
                .select('id, student_id, checked_at, note, teacher_id, type')
                .or('type.eq.late,type.is.null')
                .gte('checked_at', rollcallStart.toISOString())
                .order('checked_at', { ascending: false });

            if (error) throw error;
            setTodayLogs(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoadingLogs(false);
        }
    };

    const toggleSelectStudent = (student: Student) => {
        setSelectedStudents(prev => {
            const exists = prev.some(s => s.student_id === student.student_id);
            if (exists) {
                return prev.filter(s => s.student_id !== student.student_id);
            }
            return [...prev, student];
        });
    };

    const handleCreateViolation = async () => {
        if (selectedStudents.length === 0) {
            toast.error('학생을 먼저 선택해주세요.');
            return;
        }
        if (!selectedViolation) {
            toast.error('위반 항목을 선택해주세요.');
            return;
        }

        const studentNames = selectedStudents.map(s => `${s.student_id}`).join(', ');
        if (!confirm(`${studentNames} 학생의 [${selectedViolation}]을 등록하시겠습니까?`)) {
            return;
        }

        setIsSubmittingViolation(true);
        try {
            const currentTeacher = (teacherName && teacherName !== '담당 교사' ? teacherName : '')
                || localStorage.getItem('dormichan_teacher_name')
                || localStorage.getItem('dormichan_login_id')
                || sessionStorage.getItem('dormichan_login_id')
                || '사감교사';

            const nowIso = new Date().toISOString();
            const payload = selectedStudents.map(s => ({
                student_id: s.student_id,
                teacher_id: currentTeacher,
                type: 'late',
                note: selectedViolation,
                checked_at: nowIso
            }));

            const { data, error } = await supabase
                .from('morning_checks')
                .insert(payload)
                .select();

            if (error) throw error;

            toast.success(`${selectedStudents.length}명 위반 기록이 등록되었습니다.`);
            if (data && data.length > 0) {
                setTodayLogs(prev => [...data, ...prev]);
            }
            setSelectedStudents([]);
            setSelectedViolation(null);
            setStudentSearch('');
        } catch (err) {
            console.error(err);
            toast.error('등록에 실패했습니다.');
        } finally {
            setIsSubmittingViolation(false);
        }
    };

    const handleCreateSpecialNote = async () => {
        const trimmed = specialNote.trim();
        if (!trimmed) {
            toast.error('특이사항 내용을 입력해주세요.');
            return;
        }

        setIsSubmittingSpecialNote(true);
        try {
            const currentTeacher = (teacherName && teacherName !== '담당 교사' ? teacherName : '')
                || localStorage.getItem('dormichan_teacher_name')
                || localStorage.getItem('dormichan_login_id')
                || sessionStorage.getItem('dormichan_login_id')
                || '사감교사';

            const payload = {
                student_id: '특이사항',
                teacher_id: currentTeacher,
                type: 'late',
                note: trimmed,
                checked_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('morning_checks')
                .insert(payload)
                .select();

            if (error) throw error;

            toast.success('특이사항이 등록되었습니다.');
            if (data && data[0]) {
                setTodayLogs(prev => [data[0], ...prev]);
            }
            setSpecialNote('');
        } catch (err) {
            console.error(err);
            toast.error('등록에 실패했습니다.');
        } finally {
            setIsSubmittingSpecialNote(false);
        }
    };

    const handleDeleteLog = async (logId: string | number, note: string) => {
        if (!confirm(`[${note}] 기록을 삭제하시겠습니까?`)) return;
        try {
            const { error } = await supabase.from('morning_checks').delete().eq('id', logId);
            if (error) throw error;
            toast.success('삭제되었습니다.');
            setTodayLogs(prev => prev.filter(v => v.id !== logId));
        } catch (err) {
            console.error(err);
            toast.error('삭제에 실패했습니다.');
        }
    };

    const handleUpdateLog = async (logId: string | number) => {
        const trimmed = editingLogNote.trim();
        if (!trimmed) {
            toast.error('내용을 입력해주세요.');
            return;
        }
        setIsSavingEdit(true);
        try {
            const { error } = await supabase
                .from('morning_checks')
                .update({ note: trimmed })
                .eq('id', logId);

            if (error) throw error;

            toast.success('수정되었습니다.');
            setTodayLogs(prev =>
                prev.map(v => v.id === logId ? { ...v, note: trimmed } : v)
            );
            setEditingLogId(null);
            setEditingLogNote('');
        } catch (err) {
            console.error(err);
            toast.error('수정에 실패했습니다.');
        } finally {
            setIsSavingEdit(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden border border-gray-200 text-gray-800"
                onClick={e => e.stopPropagation()}
            >
                {/* Top Bar */}
                <div className="p-3.5 sm:p-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-white shrink-0">
                    <div className="flex-1 bg-gray-200/90 p-1 rounded-2xl flex items-center border border-gray-300/80 shadow-inner">
                        <div className="flex-1 py-2 sm:py-2.5 rounded-xl font-black text-sm sm:text-base text-center bg-yellow-400 text-yellow-950 shadow-md">
                            홍지관 기숙사일지 등록 {roomNumber ? `(${roomNumber}호)` : ''}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer text-base font-bold shrink-0"
                        aria-label="닫기"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
                    {/* Section 1: 생활규정 위반 체크 (학생지도) */}
                    {!hideViolationCheck && (<div className="space-y-2.5 border-b border-gray-100 pb-4">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                            <h3 className="text-xs sm:text-sm font-extrabold text-gray-800 flex items-center gap-1.5">
                                <span className="w-1 h-3.5 bg-yellow-400 rounded-full"></span>
                                <span>생활규정 위반 체크 (학생지도)</span>
                            </h3>
                            <span className="text-[11px] text-gray-400 font-medium">
                                학번 · 이름 · 호실번호(예: 301)로 검색 가능 (복수 선택 가능)
                            </span>
                        </div>

                        {/* Selected Students Chips */}
                        {selectedStudents.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 bg-gray-50 p-2 rounded-xl border border-gray-200">
                                {selectedStudents.map(st => {
                                    const roomNum = st.room_number || (st as any).room;
                                    return (
                                        <span
                                            key={st.student_id}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-gray-300 text-xs font-bold text-gray-900 shadow-2xs"
                                        >
                                            <span>{st.student_id}</span>
                                            {!st.student_id.includes(st.name) && <span>{st.name}</span>}
                                            {roomNum && <span className="text-[10px] text-orange-600 font-semibold">({roomNum}호)</span>}
                                            <button
                                                type="button"
                                                onClick={() => toggleSelectStudent(st)}
                                                className="text-gray-400 hover:text-gray-700 cursor-pointer ml-0.5"
                                            >
                                                <FaTimes size={10} />
                                            </button>
                                        </span>
                                    );
                                })}
                                <button
                                    type="button"
                                    onClick={() => setSelectedStudents([])}
                                    className="text-[11px] text-gray-500 hover:text-gray-800 underline px-1.5 cursor-pointer"
                                >
                                    전체 해제
                                </button>
                            </div>
                        )}

                        {/* Student Search Input */}
                        <div className="relative">
                            <div className="relative flex items-center">
                                <FaSearch className="absolute left-3 text-gray-400 text-xs" />
                                <input
                                    type="text"
                                    value={studentSearch}
                                    onChange={e => {
                                        setStudentSearch(e.target.value);
                                        setIsSearchingStudent(true);
                                    }}
                                    onFocus={() => setIsSearchingStudent(true)}
                                    placeholder="학번, 이름 또는 호실번호(예: 301) 검색..."
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-gray-400 focus:bg-white transition-colors"
                                />
                            </div>

                            {isSearchingStudent && filteredStudents.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden divide-y divide-gray-100 max-h-52 overflow-y-auto">
                                    {filteredStudents.map(student => {
                                        const isSelected = selectedStudents.some(s => s.student_id === student.student_id);
                                        const roomNum = student.room_number || (student as any).room;
                                        return (
                                            <button
                                                key={student.student_id}
                                                type="button"
                                                onClick={() => {
                                                    toggleSelectStudent(student);
                                                    setStudentSearch('');
                                                    setIsSearchingStudent(false);
                                                }}
                                                className={`w-full px-3.5 py-2 flex items-center justify-between text-left hover:bg-gray-50 cursor-pointer ${
                                                    isSelected ? 'bg-yellow-50/70' : ''
                                                }`}
                                            >
                                                <span className="font-medium text-gray-900">
                                                    {student.student_id.includes(student.name)
                                                        ? student.student_id
                                                        : `${student.student_id} ${student.name}`}
                                                </span>
                                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                                    {roomNum && (
                                                        <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 font-bold border border-orange-200/70">
                                                            {roomNum}호
                                                        </span>
                                                    )}
                                                    <span>{student.grade}-{student.class}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Violation Type Buttons + Submit */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            {VIOLATION_TYPES.map(vType => {
                                const isSelected = selectedViolation === vType;
                                return (
                                    <button
                                        key={vType}
                                        type="button"
                                        onClick={() => setSelectedViolation(isSelected ? null : vType)}
                                        className={`py-2 px-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer text-center ${
                                            isSelected
                                                ? 'bg-gray-900 text-white border-gray-900 shadow-xs'
                                                : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'
                                        }`}
                                    >
                                        {vType}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex items-center justify-between bg-gray-50 p-2 rounded-xl border border-gray-200">
                            <div className="flex items-center gap-2 text-xs text-gray-600 px-1 truncate">
                                {selectedStudents.length > 0 ? (
                                    <span className="font-bold text-gray-900">
                                        대상 {selectedStudents.length}명
                                    </span>
                                ) : (
                                    <span className="text-gray-400">학생 미선택</span>
                                )}
                                <span>·</span>
                                {selectedViolation ? (
                                    <span className="font-bold text-blue-600">{selectedViolation}</span>
                                ) : (
                                    <span className="text-gray-400">위반 항목 미선택</span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={handleCreateViolation}
                                disabled={isSubmittingViolation || selectedStudents.length === 0 || !selectedViolation}
                                className="px-4 py-1.5 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer disabled:opacity-40"
                            >
                                등록
                            </button>
                        </div>
                    </div>


                    )}<div className="space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                            <h3 className="text-xs sm:text-sm font-extrabold text-gray-800 flex items-center gap-1.5">
                                <span className="w-1 h-3.5 bg-yellow-400 rounded-full"></span>
                                <span>특이사항</span>
                            </h3>
                            <span className="text-[11px] text-gray-400 font-medium">
                                기타 건의사항·기숙사 특이사항 기록
                            </span>
                        </div>
                        <div className="flex gap-2 items-center bg-gray-50 p-2 rounded-xl border border-gray-200">
                            <input
                                type="text"
                                value={specialNote}
                                onChange={e => setSpecialNote(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleCreateSpecialNote();
                                }}
                                placeholder="기타 건의사항이나 기숙사 특이사항을 입력하세요..."
                                className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 transition-colors"
                            />
                            <button
                                type="button"
                                onClick={handleCreateSpecialNote}
                                disabled={isSubmittingSpecialNote || !specialNote.trim()}
                                className="px-3.5 py-1.5 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer disabled:opacity-40"
                            >
                                등록
                            </button>
                        </div>
                    </div>

                    {/* Section 3: 오늘 등록 내역 */}
                    <div className="pt-3 border-t border-gray-100">
                        <div className="text-xs font-semibold text-gray-500 mb-2">
                            오늘 홍지관일지 등록 내역 ({todayLogs.length}건)
                        </div>
                        <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto">
                            {isLoadingLogs ? (
                                <div className="py-4 text-center text-gray-400 text-xs">
                                    불러오는 중...
                                </div>
                            ) : todayLogs.length === 0 ? (
                                <div className="py-4 text-center text-gray-400 text-xs">
                                    오늘 등록된 내역이 없습니다.
                                </div>
                            ) : (
                                todayLogs.map(log => {
                                    const isEditing = editingLogId === log.id;
                                    const isSpecial = log.student_id === '특이사항';
                                    const studentInfo = studentMap.get(log.student_id);

                                    if (isEditing) {
                                        return (
                                            <div key={log.id} className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-300">
                                                <input
                                                    type="text"
                                                    value={editingLogNote}
                                                    onChange={e => setEditingLogNote(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleUpdateLog(log.id);
                                                    }}
                                                    className="flex-1 bg-white border border-gray-200 rounded px-2.5 py-1 text-xs text-gray-900"
                                                    autoFocus
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateLog(log.id)}
                                                    disabled={isSavingEdit}
                                                    className="px-2.5 py-1 bg-gray-900 text-white rounded text-xs font-semibold cursor-pointer"
                                                >
                                                    저장
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setEditingLogId(null); setEditingLogNote(''); }}
                                                    className="px-2 py-1 bg-gray-200 text-gray-600 rounded text-xs cursor-pointer"
                                                >
                                                    취소
                                                </button>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={log.id}
                                            className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs"
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                {isSpecial ? (
                                                    <span className="font-bold text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                                                        특이사항
                                                    </span>
                                                ) : (
                                                    <>
                                                        <span className="font-bold text-gray-900 shrink-0">{log.student_id}</span>
                                                        {studentInfo && !log.student_id.includes(studentInfo.name) && (
                                                            <span className="text-gray-600 font-medium shrink-0">{studentInfo.name}</span>
                                                        )}
                                                    </>
                                                )}
                                                <span className="text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded truncate max-w-[260px]">
                                                    {log.note}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0 ml-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingLogId(log.id);
                                                        setEditingLogNote(log.note);
                                                    }}
                                                    className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer"
                                                    title="수정"
                                                >
                                                    <FaEdit size={12} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteLog(log.id, log.note)}
                                                    className="p-1 text-gray-400 hover:text-red-600 cursor-pointer"
                                                    title="삭제"
                                                >
                                                    <FaTrash size={11} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-end shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}
