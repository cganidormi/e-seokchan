'use client';

import React, { useState } from 'react';
import Select from 'react-select';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Student, Teacher } from './types';
import { supabase } from '@/supabaseClient';

interface LeaveRequestFormProps {
    studentId: string;
    students: Student[];
    teachers: Teacher[];
    onSubmitSuccess: () => void;
}

export const LeaveRequestForm: React.FC<LeaveRequestFormProps> = ({
    studentId,
    students,
    teachers,
    onSubmitSuccess
}) => {
    const leaveTypes = ['컴이석', '이석', '외출', '외박', '자리비움'];
    const leavePlaces = ['교실', '도서관', '식당', '기타'];

    const [addedStudents, setAddedStudents] = useState<Student[]>([]);
    const [leaveType, setLeaveType] = useState('컴이석');
    const [teacherId, setTeacherId] = useState('');
    const [place, setPlace] = useState('');
    const [reason, setReason] = useState('');
    const [periods, setPeriods] = useState<string[]>([]);
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [targetDate, setTargetDate] = useState<Date>(new Date());

    // Initialize login student
    React.useEffect(() => {
        const loginStudent = students.find(s => s.student_id === studentId);
        if (loginStudent) setAddedStudents([loginStudent]);
    }, [studentId, students]);

    const togglePeriod = (p: string) => {
        setPeriods(prev =>
            prev.includes(p) ? prev.filter(v => v !== p) : [...prev, p]
        );
    };

    const handleSubmit = async () => {
        const now = new Date();
        const isToday = targetDate.toDateString() === now.toDateString();

        if (isToday && (leaveType === '이석' || leaveType === '컴이석') && periods.length > 0) {
            const day = targetDate.getDay();
            const isWeekend = day === 0 || day === 6;

            const { data: timetable } = await supabase.from('timetable_entries').select('*');

            if (timetable) {
                for (const p of periods) {
                    let matchType = '';
                    const periodNum = p.match(/\d+/) ? p.match(/\d+/)![0] : '';

                    if (p.startsWith('주간')) matchType = 'weekday day';
                    else if (p.startsWith('야간')) matchType = isWeekend ? 'weekend night' : 'weekday night';
                    else if (p.startsWith('오전')) matchType = 'weekend morning';
                    else if (p.startsWith('오후')) matchType = 'weekend afternoon';

                    const entry = timetable.find(t => {
                        const dt = t.day_type.toLowerCase();
                        const desc = t.description?.toLowerCase() || '';
                        const normalizedMatchType = matchType.toLowerCase();
                        const typeMatched = dt.includes(normalizedMatchType);
                        const numMatched = dt.includes(periodNum) || desc.includes(periodNum);
                        return typeMatched && numMatched;
                    });

                    if (entry && entry.end_time) {
                        const [hours, minutes] = entry.end_time.split(':').map(Number);
                        const periodEndTime = new Date(now);
                        periodEndTime.setHours(hours, minutes, 59, 999);

                        if (now > periodEndTime) {
                            toast.error(`이미 지난 시간(${p})은 신청할 수 없습니다. (${entry.end_time} 종료)`);
                            return;
                        }
                    }
                }
            }
        }

        if (
            !studentId ||
            !leaveType ||
            ((leaveType === '컴이석' || leaveType === '이석') && periods.length === 0) ||
            ((leaveType === '외출' || leaveType === '외박') && (!startDate || !endDate)) ||
            (leaveType === '이석' && (!teacherId || !place || !reason))
        ) {
            toast.error('필수 항목을 모두 입력하세요.');
            return;
        }

        if (leaveType === '외출' && startDate && endDate) {
            if (startDate.toDateString() !== endDate.toDateString()) {
                toast.error('외출은 당일 신청만 가능합니다.');
                return;
            }
        }

        const checkDate = (leaveType === '외출' || leaveType === '외박') ? startDate : targetDate;
        if (!checkDate) return;

        const startOfDay = new Date(checkDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = (leaveType === '외박' && endDate) ? new Date(endDate) : new Date(checkDate);
        endOfDay.setHours(23, 59, 59, 999);

        const studentIds = addedStudents.map(s => s.student_id);

        const { data: mainExist } = await supabase
            .from('leave_requests')
            .select('id, leave_type, start_time, end_time, period, student_id, status')
            .in('student_id', studentIds)
            .in('status', ['신청', '승인'])
            .lte('start_time', endOfDay.toISOString())
            .gte('end_time', startOfDay.toISOString());

        const { data: coData } = await supabase
            .from('leave_request_students')
            .select('leave_request_id')
            .in('student_id', studentIds);

        const coIds = coData?.map(c => c.leave_request_id) || [];
        let coExist: any[] = [];
        if (coIds.length > 0) {
            const { data: fetchedCo } = await supabase
                .from('leave_requests')
                .select('id, leave_type, start_time, end_time, period, student_id, status')
                .in('id', coIds)
                .in('status', ['신청', '승인'])
                .lte('start_time', endOfDay.toISOString())
                .gte('end_time', startOfDay.toISOString());
            coExist = fetchedCo || [];
        }

        const combinedExist = [...(mainExist || []), ...coExist];
        const existingLeaves = combinedExist.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);

        if (existingLeaves && existingLeaves.length > 0) {
            let newStart: Date, newEnd: Date;
            if (leaveType === '외출' || leaveType === '외박') {
                if (!startDate || !endDate) return;
                newStart = new Date(startDate);
                newEnd = new Date(endDate);
            } else {
                newStart = new Date(targetDate);
                newEnd = new Date(targetDate);
            }

            for (const exist of existingLeaves) {
                if (exist.period) {
                    const existPeriods = exist.period.split(',');
                    const duplicatePeriod = periods.find(p => existPeriods.includes(p));
                    if (duplicatePeriod) {
                        toast.error(`[중복] ${exist.student_id} 학생: 이미 ${duplicatePeriod}에 '${exist.leave_type}' 신청이 있습니다.`);
                        return;
                    }
                }

                if (leaveType === '외출' || leaveType === '외박') {
                    const existStart = new Date(exist.start_time);
                    const existEnd = new Date(exist.end_time);
                    if (existStart < newEnd && existEnd > newStart) {
                        toast.error(`[시간 중복] ${exist.student_id} 학생: 기존 '${exist.leave_type}'과 겹칩니다.`);
                        return;
                    }
                }
            }
        }

        let finalStartTime = startDate?.toISOString();
        let finalEndTime = endDate?.toISOString();
        let finalStatus = '신청';
        let finalPeriod = (leaveType === '외출' || leaveType === '외박' || leaveType === '자리비움') ? null : periods.join(',');

        if (leaveType === '컴이석' || leaveType === '이석') {
            const periodEndTime = new Date(targetDate);
            periodEndTime.setHours(23, 59, 59, 999);
            finalStartTime = targetDate.toISOString();
            finalEndTime = periodEndTime.toISOString();
            if (leaveType === '컴이석') finalStatus = '승인';
        } else if (leaveType === '자리비움') {
            const now = new Date();
            finalStartTime = now.toISOString();
            finalEndTime = new Date(now.getTime() + 10 * 60000).toISOString();
            finalStatus = '승인';
        }

        const { data: leaveData, error: leaveError } = await supabase
            .from('leave_requests')
            .insert([{
                student_id: studentId,
                leave_type: leaveType,
                teacher_id: (leaveType === '컴이석' || leaveType === '자리비움') ? null : teacherId,
                place: (leaveType === '컴이석' || leaveType === '자리비움') ? null : place,
                reason: (leaveType === '컴이석' || leaveType === '자리비움') ? (leaveType === '자리비움' ? '10분간 자리비움' : null) : reason,
                period: finalPeriod,
                start_time: finalStartTime,
                end_time: finalEndTime,
                status: finalStatus,
            }])
            .select()
            .single();

        if (leaveError || !leaveData) {
            toast.error('신청 저장 실패');
            return;
        }

        const additionalStudents = addedStudents.filter(s => s.student_id !== studentId);
        if (additionalStudents.length > 0) {
            await supabase.from('leave_request_students').insert(
                additionalStudents.map(s => ({
                    leave_request_id: leaveData.id,
                    student_id: s.student_id,
                }))
            );
        }

        onSubmitSuccess();
        setLeaveType('');
        setTeacherId('');
        setPlace('');
        setReason('');
        setPeriods([]);
        setStartDate(null);
        setEndDate(null);
        toast.success(leaveType === '자리비움' ? '10분간 자리비움이 승인되었습니다.' : '이석 신청이 완료되었습니다.');
    };

    return (
        <div className="flex flex-col w-full max-w-xl mx-auto relative">
            <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-6 bg-yellow-400 rounded-full"></div>
                <h1 className="text-xl font-extrabold text-gray-800">이석 신청</h1>
            </div>

            <div className="flex flex-col gap-2 mb-4">
                <span>신청자</span>
                <Select
                    instanceId="student-select"
                    isMulti
                    value={addedStudents.map(s => ({ value: s.student_id, label: s.student_id, student: s }))}
                    options={students.map(s => ({ value: s.student_id, label: s.student_id, student: s }))}
                    onChange={(options: any) => {
                        let selected = options ? (Array.isArray(options) ? options.map((o: any) => o.student) : [options.student]) : [];
                        const loginStudent = students.find(s => s.student_id === studentId);
                        if (loginStudent && !selected.some((s: any) => s.student_id === studentId)) selected = [loginStudent, ...selected];
                        setAddedStudents(selected);
                    }}
                    styles={{
                        control: (base) => ({
                            ...base,
                            borderRadius: '1rem',
                            padding: '0.25rem',
                            borderColor: '#e5e7eb',
                            boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                            ':hover': { borderColor: '#fbbf24' },
                        }),
                        multiValue: (base) => ({ ...base, backgroundColor: '#fefce8', border: '1px solid #fde68a', borderRadius: '0.5rem', margin: '2px' }),
                        multiValueLabel: (base) => ({ ...base, color: '#854d0e', fontWeight: '600', padding: '2px 8px', fontSize: '0.875rem' }),
                    }}
                    placeholder="신청자 선택 (검색 가능)"
                />
            </div>

            <div className="grid grid-cols-5 gap-2 mb-4">
                {leaveTypes.map((t) => (
                    <button
                        key={t}
                        onClick={() => {
                            setLeaveType(t);
                            setPeriods([]);
                            setTeacherId('');
                            setPlace('');
                            setReason('');
                            setStartDate(new Date());
                            setEndDate(new Date());
                            if (t === '외출' || t === '외박' || t === '자리비움') {
                                const loginStudent = students.find(s => s.student_id === studentId);
                                if (loginStudent) setAddedStudents([loginStudent]);
                            }
                        }}
                        className={clsx(
                            'h-12 rounded-2xl shadow-sm border transition-all duration-200 active:scale-95 font-medium w-full flex items-center justify-center',
                            leaveType === t ? 'bg-yellow-400 text-white border-yellow-400 shadow-md font-bold' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        )}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {/* Unified Conditional Content Wrapper */}
            <div className={clsx(
                "grid transition-all duration-300 overflow-hidden",
                (leaveType && leaveType !== '자리비움') ? "grid-rows-[1fr] opacity-100 mb-4" : "grid-rows-[0fr] opacity-0 mb-0"
            )}>
                <div className="min-h-0 flex flex-col gap-4">
                    {/* Period selection for Leave/Computer Leave */}
                    {(leaveType === '컴이석' || leaveType === '이석') && (
                        <div className="flex flex-col gap-4">
                            <DatePicker
                                selected={targetDate}
                                onChange={(date) => { if (date) { setTargetDate(date); setPeriods([]); } }}
                                dateFormat="yyyy-MM-dd"
                                className="h-12 px-4 rounded-2xl border border-gray-200 bg-white w-full text-center shadow-sm cursor-pointer transition-all hover:border-yellow-400 font-bold"
                            />
                            <div className={clsx(
                                "bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden",
                                targetDate.getDay() === 0 || targetDate.getDay() === 6 ? "grid grid-cols-3 divide-x divide-gray-100" : "flex flex-col p-3 gap-1"
                            )}>
                                {(targetDate.getDay() === 0 || targetDate.getDay() === 6
                                    ? [{ key: '오전', label: '오전', p: ['1', '2', '3'] }, { key: '오후', label: '오후', p: ['4', '5', '6'] }, { key: '야간_공휴일', label: '야간', p: ['1', '2', '3'] }]
                                    : [{ key: '주간', label: '주간', p: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] }, { key: '야간', label: '야간', p: ['1', '2', '3', '4'] }]
                                ).map((type) => (
                                    <div key={type.key} className="flex flex-col gap-2 p-2 w-full">
                                        <div className="flex items-center gap-2 px-1">
                                            <div className="w-1 h-4 bg-yellow-400 rounded-full"></div>
                                            <span className="text-sm font-bold text-gray-700">{type.label}</span>
                                        </div>
                                        <div className="flex gap-1.5 flex-wrap">
                                            {type.p.map(p => {
                                                const label = `${type.label}${p}교시`;
                                                const isSelected = periods.includes(label);
                                                return (
                                                    <button key={p} onClick={() => togglePeriod(label)} className={clsx('w-10 h-10 rounded-xl text-sm font-bold transition-all border shadow-sm flex items-center justify-center', isSelected ? 'bg-yellow-400 text-white border-yellow-400 scale-105' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100')}>
                                                        {p}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Date range for Outing/Overnight */}
                    {(leaveType === '외출' || leaveType === '외박') && (
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                            <DatePicker selected={startDate} onChange={setStartDate} showTimeSelect timeIntervals={10} dateFormat="yyyy-MM-dd HH:mm" className="h-12 px-4 rounded-2xl border border-gray-200 bg-white w-full shadow-sm cursor-pointer" />
                            <DatePicker selected={endDate} onChange={setEndDate} showTimeSelect timeIntervals={10} dateFormat="yyyy-MM-dd HH:mm" className="h-12 px-4 rounded-2xl border border-gray-200 bg-white w-full shadow-sm cursor-pointer" />
                        </div>
                    )}

                    {/* Details for Leave/Outing/Overnight (Exclude Computer Leave/Away) */}
                    {(leaveType !== '컴이석' && leaveType !== '자리비움' && leaveType !== '') && (
                        <div className="flex flex-col gap-3">
                            <select value={teacherId} onChange={e => setTeacherId(e.target.value)} className="h-12 px-4 rounded-2xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-sm w-full">
                                <option value="">지도교사</option>
                                {teachers.map(t => t.id && <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            <select value={place} onChange={e => setPlace(e.target.value)} className="h-12 px-4 rounded-2xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-sm w-full">
                                <option value="">이석 장소</option>
                                {leavePlaces.map(p => <option key={p}>{p}</option>)}
                            </select>
                            <input type="text" value={reason} onChange={e => setReason(e.target.value)} className="h-12 px-4 rounded-2xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-sm w-full" placeholder="이석 사유" />
                        </div>
                    )}
                </div>
            </div>

            <button onClick={handleSubmit} className="h-14 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold text-lg shadow-md hover:shadow-lg transform active:scale-95 transition-all mb-8">
                신청
            </button>
        </div>
    );
};
