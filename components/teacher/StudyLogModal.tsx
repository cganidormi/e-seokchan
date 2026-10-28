'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/supabaseClient';
import toast from 'react-hot-toast';
import { 
    FaSearch, 
    FaCheck, 
    FaTrash, 
    FaEdit, 
    FaPlus
} from 'react-icons/fa';

export interface Student {
    student_id: string;
    name: string;
    grade: number;
    class: number;
    weekend?: boolean;
}

interface StudyLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    students: Student[];
    teacherName: string;
    initialStudentId?: string | null;
    defaultRoomNumber?: number;
}

interface YanghyeonjaeLog {
    id: string | number;
    student_id: string;
    teacher_id: string;
    note: string;
    checked_at: string;
}

interface FacilityRequest {
    id: number;
    title: string;
    room_number?: number | null;
    status: string;
    created_at: string;
}

export default function StudyLogModal({
    isOpen,
    onClose,
    students,
    teacherName,
    initialStudentId = null,
    defaultRoomNumber = 1
}: StudyLogModalProps) {
    const [activeTab, setActiveTab] = useState<'yanghyeonjae' | 'facility'>('yanghyeonjae');

    // [Tab 1] 양현재 일지 상태
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [studentSearch, setStudentSearch] = useState('');
    const [isSearchingStudent, setIsSearchingStudent] = useState(false);

    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [violationDetail, setViolationDetail] = useState('');
    const [isSubmittingViolation, setIsSubmittingViolation] = useState(false);

    const [todayYanghyeonjaeLogs, setTodayYanghyeonjaeLogs] = useState<YanghyeonjaeLog[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

    const [editingLogId, setEditingLogId] = useState<string | number | null>(null);
    const [editingLogNote, setEditingLogNote] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // [Tab 2] 시설물 수리 상태
    const [facilityTitle, setFacilityTitle] = useState('');
    const [isSubmittingFacility, setIsSubmittingFacility] = useState(false);
    const [facilityRequests, setFacilityRequests] = useState<FacilityRequest[]>([]);
    const [isLoadingFacility, setIsLoadingFacility] = useState(false);

    const studentMap = useMemo(() => {
        const map = new Map<string, Student>();
        students.forEach(s => map.set(s.student_id, s));
        return map;
    }, [students]);

    const filteredStudents = useMemo(() => {
        const query = studentSearch.trim().toLowerCase();
        if (!query) return [];
        return students
            .filter(s => s.student_id.toLowerCase().includes(query) || s.name.toLowerCase().includes(query))
            .slice(0, 6);
    }, [students, studentSearch]);

    useEffect(() => {
        if (isOpen) {
            if (initialStudentId && studentMap.has(initialStudentId)) {
                setSelectedStudent(studentMap.get(initialStudentId) || null);
            }
            fetchTodayYanghyeonjaeLogs();
            fetchFacilityRequests();
        } else {
            setSelectedCategory(null);
            setViolationDetail('');
            setEditingLogId(null);
        }
    }, [isOpen, initialStudentId, studentMap]);

    const getRollcallStartTime = () => {
        const now = new Date();
        return now.getHours() < 18
            ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 18, 0, 0, 0)
            : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0, 0);
    };

    const fetchTodayYanghyeonjaeLogs = async () => {
        setIsLoadingLogs(true);
        try {
            const rollcallStart = getRollcallStartTime();

            const { data, error } = await supabase
                .from('morning_checks')
                .select('id, student_id, checked_at, note, teacher_id')
                .eq('type', 'yanghyeonjae')
                .gte('checked_at', rollcallStart.toISOString())
                .order('checked_at', { ascending: false });

            if (error) throw error;
            setTodayYanghyeonjaeLogs(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoadingLogs(false);
        }
    };

    const fetchFacilityRequests = async () => {
        setIsLoadingFacility(true);
        try {
            const rollcallStart = getRollcallStartTime();

            const { data, error } = await supabase
                .from('facility_requests')
                .select('*')
                .gte('created_at', rollcallStart.toISOString())
                .order('created_at', { ascending: false });

            if (error) throw error;
            setFacilityRequests(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoadingFacility(false);
        }
    };

    const handleCreateYanghyeonjaeViolation = async () => {
        if (!selectedStudent) {
            toast.error('학생을 먼저 선택해주세요.');
            return;
        }
        if (!selectedCategory) {
            toast.error('항목을 선택해주세요.');
            return;
        }

        const category = selectedCategory;
        const detail = violationDetail.trim();
        if (category === '기타' && !detail) {
            toast.error('기타 항목의 상세 내용을 입력해주세요.');
            return;
        }

        const violationNote = detail ? `${category}: ${detail}` : category;

        if (!confirm(`${selectedStudent.student_id} ${selectedStudent.name} 학생의 [${violationNote}]을 등록하시겠습니까?`)) {
            return;
        }

        setIsSubmittingViolation(true);
        try {
            const currentTeacher = (teacherName && teacherName !== '담당 교사' ? teacherName : '') 
                || localStorage.getItem('dormichan_login_id') 
                || sessionStorage.getItem('dormichan_login_id') 
                || '지도교사';

            const payload = {
                student_id: selectedStudent.student_id,
                teacher_id: currentTeacher,
                type: 'yanghyeonjae',
                note: violationNote,
                checked_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('morning_checks')
                .insert(payload)
                .select();

            if (error) throw error;

            toast.success('등록되었습니다.');
            if (data && data[0]) {
                setTodayYanghyeonjaeLogs(prev => [data[0], ...prev]);
            }
            setSelectedCategory(null);
            setViolationDetail('');
        } catch (err) {
            console.error(err);
            toast.error('등록에 실패했습니다.');
        } finally {
            setIsSubmittingViolation(false);
        }
    };

    const handleDeleteYanghyeonjaeLog = async (logId: string | number, note: string) => {
        if (!confirm(`[${note}] 기록을 삭제하시겠습니까?`)) return;
        try {
            const { error } = await supabase.from('morning_checks').delete().eq('id', logId);
            if (error) throw error;
            toast.success('삭제되었습니다.');
            setTodayYanghyeonjaeLogs(prev => prev.filter(v => v.id !== logId));
        } catch (err) {
            console.error(err);
            toast.error('삭제에 실패했습니다.');
        }
    };

    const handleUpdateYanghyeonjaeLog = async (logId: string | number) => {
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
            setTodayYanghyeonjaeLogs(prev =>
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

    const handleCreateFacilityRequest = async () => {
        const trimmed = facilityTitle.trim();
        if (!trimmed) {
            toast.error('수리 요청 내용을 입력해주세요.');
            return;
        }

        // 학습실 기재 여부 확인 (예: 1실, 2실, 3실 등)
        const hasRoomMention = /[1-9]/.test(trimmed) || /실|호|양현재/.test(trimmed);
        if (!hasRoomMention) {
            toast.error('어느 실인지 꼭 적어주세요. (예: 1실 등)');
            return;
        }

        let parsedRoom: number | null = null;
        const roomMatch = trimmed.match(/([1-3])\s*(?:학습실|열람실|실)/) || trimmed.match(/(\d{3})/);
        if (roomMatch) {
            parsedRoom = parseInt(roomMatch[1]);
        } else {
            parsedRoom = defaultRoomNumber;
        }

        setIsSubmittingFacility(true);
        try {
            const { data, error } = await supabase.from('facility_requests').insert({
                title: trimmed,
                room_number: parsedRoom,
                status: '대기'
            }).select().single();

            if (error) throw error;

            toast.success('수리 요청이 등록되었습니다.');
            if (data) {
                setFacilityRequests(prev => [data, ...prev]);
            }
            setFacilityTitle('');
        } catch (err) {
            console.error(err);
            toast.error('등록 실패');
        } finally {
            setIsSubmittingFacility(false);
        }
    };

    const handleToggleFacilityStatus = async (id: number, currentStatus: string) => {
        const newStatus = currentStatus === '완료' ? '대기' : '완료';
        setFacilityRequests(prev => prev.map(item => item.id === id ? { ...item, status: newStatus } : item));
        try {
            const { error } = await supabase.from('facility_requests').update({ status: newStatus }).eq('id', id);
            if (error) throw error;
        } catch (err) {
            console.error(err);
            fetchFacilityRequests();
        }
    };

    const handleDeleteFacility = async (id: number) => {
        if (!confirm('삭제하시겠습니까?')) return;
        setFacilityRequests(prev => prev.filter(item => item.id !== id));
        try {
            const { error } = await supabase.from('facility_requests').delete().eq('id', id);
            if (error) throw error;
            toast.success('삭제되었습니다.');
        } catch (err) {
            console.error(err);
            fetchFacilityRequests();
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header: Clean & Simple */}
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                    <h2 className="text-base font-bold text-gray-900">학습일지 / 시설물</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1 text-sm cursor-pointer"
                        aria-label="닫기"
                    >
                        ✕
                    </button>
                </div>

                {/* Tabs: Minimal Underline */}
                <div className="flex border-b border-gray-100 px-5 gap-6 text-sm bg-white shrink-0">
                    <button
                        type="button"
                        onClick={() => setActiveTab('yanghyeonjae')}
                        className={`py-3 font-semibold transition-all border-b-2 cursor-pointer ${
                            activeTab === 'yanghyeonjae'
                                ? 'border-gray-900 text-gray-900'
                                : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        양현재 일지 등록
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('facility')}
                        className={`py-3 font-semibold transition-all border-b-2 cursor-pointer ${
                            activeTab === 'facility'
                                ? 'border-gray-900 text-gray-900'
                                : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        시설물 수리요청
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
                    {/* TAB 1: 양현재 일지 */}
                    {activeTab === 'yanghyeonjae' && (
                        <div className="space-y-4">
                            {/* Student Search & Select */}
                            <div>
                                <p className="text-xs text-blue-600 font-medium mb-2">
                                    학생의 이름을 모르실 경우 좌석을 더블터치해서 지도 내용을 기록하시면 됩니다.
                                </p>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                    학생 선택
                                </label>
                                {selectedStudent ? (
                                    <div className="flex items-center justify-between bg-gray-50 border border-gray-200 px-3.5 py-2.5 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-900">{selectedStudent.student_id}</span>
                                            <span className="font-medium text-gray-700">{selectedStudent.name}</span>
                                            <span className="text-xs text-gray-400">({selectedStudent.grade}학년 {selectedStudent.class}반)</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedStudent(null);
                                                setStudentSearch('');
                                            }}
                                            className="text-xs text-gray-500 hover:text-gray-800 underline cursor-pointer"
                                        >
                                            변경
                                        </button>
                                    </div>
                                ) : (
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
                                                placeholder="학번 또는 이름 검색..."
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-gray-400 focus:bg-white transition-colors"
                                            />
                                        </div>

                                        {isSearchingStudent && filteredStudents.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden divide-y divide-gray-100">
                                                {filteredStudents.map(student => (
                                                    <button
                                                        key={student.student_id}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedStudent(student);
                                                            setIsSearchingStudent(false);
                                                            setStudentSearch('');
                                                        }}
                                                        className="w-full px-3.5 py-2 flex items-center justify-between text-left hover:bg-gray-50 cursor-pointer"
                                                    >
                                                        <span className="font-medium text-gray-900">
                                                            {student.student_id} {student.name}
                                                        </span>
                                                        <span className="text-xs text-gray-400">
                                                            {student.grade}-{student.class}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Category Grid */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                    위반 항목
                                </label>
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                                    {['졸음', '전자기기 위반', '무단이석', '지각 입실', '소란', '기타'].map(cat => {
                                        const isSelected = selectedCategory === cat;
                                        return (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => {
                                                    if (isSelected) {
                                                        setSelectedCategory(null);
                                                        setViolationDetail('');
                                                    } else {
                                                        setSelectedCategory(cat);
                                                    }
                                                }}
                                                className={`py-2 px-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer text-center ${
                                                    isSelected
                                                        ? 'bg-gray-900 text-white border-gray-900'
                                                        : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'
                                                }`}
                                            >
                                                {cat}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Detail Input & Submit */}
                            {selectedCategory && (
                                <div className="flex gap-2 items-center bg-gray-50 p-2 rounded-xl border border-gray-200">
                                    <span className="text-xs font-bold text-gray-700 shrink-0 px-2 py-1 bg-white border border-gray-200 rounded-md">
                                        {selectedCategory}
                                    </span>
                                    <input
                                        type="text"
                                        className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs sm:text-sm text-gray-900 outline-none focus:border-gray-400"
                                        placeholder={selectedCategory === '기타' ? '상세 사유 (필수)' : '상세 내용 (선택)'}
                                        value={violationDetail}
                                        onChange={e => setViolationDetail(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleCreateYanghyeonjaeViolation();
                                        }}
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={handleCreateYanghyeonjaeViolation}
                                        disabled={isSubmittingViolation || (selectedCategory === '기타' && !violationDetail.trim())}
                                        className="px-3.5 py-1.5 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer disabled:opacity-40"
                                    >
                                        등록
                                    </button>
                                </div>
                            )}

                            {/* Today's Log List */}
                            <div className="pt-3 border-t border-gray-100">
                                <div className="text-xs font-semibold text-gray-500 mb-2">
                                    오늘 등록 내역 ({todayYanghyeonjaeLogs.length}건)
                                </div>
                                <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto">
                                    {todayYanghyeonjaeLogs.length === 0 ? (
                                        <div className="py-5 text-center text-gray-400 text-xs">
                                            등록된 내역이 없습니다.
                                        </div>
                                    ) : (
                                        todayYanghyeonjaeLogs.map(log => {
                                            const isEditing = editingLogId === log.id;
                                            const studentInfo = studentMap.get(log.student_id);

                                            if (isEditing) {
                                                return (
                                                    <div key={log.id} className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-300">
                                                        <input
                                                            type="text"
                                                            value={editingLogNote}
                                                            onChange={e => setEditingLogNote(e.target.value)}
                                                            className="flex-1 bg-white border border-gray-200 rounded px-2.5 py-1 text-xs"
                                                            autoFocus
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUpdateYanghyeonjaeLog(log.id)}
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
                                                        <span className="font-bold text-gray-900">{log.student_id}</span>
                                                        {studentInfo && <span className="text-gray-600 font-medium">{studentInfo.name}</span>}
                                                        <span className="text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded truncate max-w-[220px]">
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
                                                            onClick={() => handleDeleteYanghyeonjaeLog(log.id, log.note)}
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
                    )}

                    {/* TAB 2: 시설물 수리요청 */}
                    {activeTab === 'facility' && (
                        <div className="space-y-4">
                            {/* Input & Submit */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={facilityTitle}
                                    onChange={e => setFacilityTitle(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleCreateFacilityRequest();
                                    }}
                                    placeholder="예: 1실 000학생 책상 등 고장, 천장 누수 등"
                                    className="flex-1 bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 placeholder:opacity-100 focus:outline-none focus:border-gray-500 shadow-2xs transition-colors"
                                />
                                <button
                                    type="button"
                                    onClick={handleCreateFacilityRequest}
                                    disabled={isSubmittingFacility || !facilityTitle.trim()}
                                    className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-40 shrink-0"
                                >
                                    등록
                                </button>
                            </div>

                            {/* Facility Requests List */}
                            <div className="pt-3 border-t border-gray-100">
                                <div className="text-xs font-semibold text-gray-500 mb-2">
                                    오늘 수리 요청 ({facilityRequests.length}건)
                                </div>
                                <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto">
                                    {facilityRequests.length === 0 ? (
                                        <div className="py-6 text-center text-gray-400 text-xs">
                                            오늘 등록된 수리 요청이 없습니다.
                                        </div>
                                    ) : (
                                        facilityRequests.map(req => {
                                            const isDone = req.status === '완료';
                                            return (
                                                <div
                                                    key={req.id}
                                                    className={`flex items-center justify-between border rounded-lg px-3 py-2 text-xs transition-colors ${
                                                        isDone ? 'bg-gray-50 border-gray-200 text-gray-400' : 'bg-white border-gray-200 text-gray-800'
                                                    }`}
                                                >
                                                    <div 
                                                        onClick={() => handleToggleFacilityStatus(req.id, req.status)}
                                                        className="flex items-center gap-2 flex-1 truncate cursor-pointer"
                                                    >
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                            isDone ? 'bg-gray-200 text-gray-600' : 'bg-gray-100 text-gray-800'
                                                        }`}>
                                                            {req.status || '대기'}
                                                        </span>
                                                        <span className={`truncate ${isDone ? 'line-through' : 'font-medium'}`}>
                                                            {req.title}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleFacilityStatus(req.id, req.status)}
                                                            className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer"
                                                            title={isDone ? '대기로 변경' : '완료로 변경'}
                                                        >
                                                            <FaCheck size={11} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteFacility(req.id)}
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
                    )}
                </div>

                {/* Footer: Simple close button only */}
                <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-end shrink-0">
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
