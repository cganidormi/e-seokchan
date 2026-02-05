'use client';

import React, { useState } from 'react';
import Select, { components } from 'react-select';
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
    initialData?: any; // New prop for copy
}

const CustomDropdownIndicator = (props: any) => {
    return (
        <components.DropdownIndicator {...props}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
        </components.DropdownIndicator>
    );
};

export const LeaveRequestForm: React.FC<LeaveRequestFormProps> = ({
    studentId,
    students,
    teachers,
    onSubmitSuccess,
    initialData
}) => {
    const leaveTypes = ['컴이석', '이석', '외출', '외박', '자리비움'];

    // 이석(교내) 장소 목록
    const inSchoolPlaces = [
        '1-1반', '1-2반', '1-3반', '2-1반', '2-2반', '2-3반', '3-1반', '3-2반', '3-3반',
        'steam실', '교무실', '농구장', '대회의실', '멀티미디어실', '물리세미나실', '물리실험실',
        '상담실', '생물세미나실', '생물실험실', '선각재', '소회의실', '수학탐구실', '시청각실', '음악실',
        '지구과학세미나실', '지구과학실험실', '천문대', '체육관', '코어랩', '폴라리스', '풋살장', '학생부', '화학세미나실', '화학실험실', '휴게실'
    ];

    // 외출/외박(교외) 장소 목록
    const outSchoolPlaces = [
        '학원', '병원', '집',
        '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '포항',
        '경기도', '강원도', '충청북도', '충청남도', '전라북도', '전라남도', '경상북도', '경상남도', '제주도'
    ];

    const [addedStudents, setAddedStudents] = useState<Student[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [leaveType, setLeaveType] = useState('');

    const leavePlaces = (leaveType === '외출' || leaveType === '외박') ? outSchoolPlaces : inSchoolPlaces;


    const [teacherId, setTeacherId] = useState('');
    const [place, setPlace] = useState('');
    const [reason, setReason] = useState('');
    const [periods, setPeriods] = useState<string[]>([]);
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [targetDate, setTargetDate] = useState<Date>(new Date());
    const [specialHolidays, setSpecialHolidays] = useState<string[]>([]);

    // Initialize login student and fetch holidays
    React.useEffect(() => {
        if (!studentId) return;

        const loginStudent = students.find(s => s.student_id === studentId);
        if (loginStudent) {
            setAddedStudents(prev => {
                // 본인이 이미 포함되어 있는지 확인
                // 초기 로딩 시점에는 [loginStudent]로 덮어쓰는 게 안전함 (새로고침 시)
                return [loginStudent];
            });
        }

        const fetchHolidays = async () => {
            const { data } = await supabase.from('special_holidays').select('date');
            if (data) setSpecialHolidays(data.map(h => h.date));
        };
        fetchHolidays();
    }, [studentId, students]);

    const isDateHoliday = (date: Date) => {
        const day = date.getDay();
        const isWeekend = day === 0 || day === 6;
        if (isWeekend) return true;

        const dateStr = date.toLocaleDateString('en-CA'); // YYYY-MM-DD
        return specialHolidays.includes(dateStr);
    };

    const togglePeriod = (p: string) => {
        setPeriods(prev =>
            prev.includes(p) ? prev.filter(v => v !== p) : [...prev, p]
        );
    };

    // Populate form when initialData changes (Copy feature)
    React.useEffect(() => {
        if (!initialData) return;

        setLeaveType(initialData.leave_type);
        setTeacherId(initialData.teacher_id || '');
        setPlace(initialData.place || '');
        setReason(initialData.reason || '');

        if (initialData.period) {
            setPeriods(initialData.period.split(',').map((p: string) => p.trim()));
        } else {
            setPeriods([]);
        }

        if (initialData.start_time) setStartDate(new Date(initialData.start_time));
        if (initialData.end_time) setEndDate(new Date(initialData.end_time));
        if (initialData.start_time) setTargetDate(new Date(initialData.start_time)); // Set target date for leave/comp leave

        // Students are NOT copied by design (only current user applies)
    }, [initialData]);

    const handleSubmit = async () => {
        if (isSubmitting) return;

        try {
            setIsSubmitting(true);

            const now = new Date();

            // Weekly Home Time Validation
            const validationStudent = students.find(s => s.student_id === studentId);
            if (validationStudent?.weekend) {
                const day = now.getDay();
                const hour = now.getHours();
                const minute = now.getMinutes();
                let isRestricted = false;

                if (day === 5 && hour >= 17) isRestricted = true; // Friday >= 17:00
                if (day === 6) isRestricted = true; // Saturday All Day
                if (day === 0) { // Sunday <= 18:50
                    if (hour < 18) isRestricted = true;
                    if (hour === 18 && minute <= 50) isRestricted = true;
                }

                if (isRestricted) {
                    toast.error('매주 귀가 학생은 귀가 시간대(금요일 17:00 ~ 일요일 18:50)에 이석 신청을 할 수 없습니다.');
                    return;
                }
            }

            const isToday = targetDate.toDateString() === now.toDateString();

            if (isToday && (leaveType === '이석' || leaveType === '컴이석') && periods.length > 0) {
                const isHoliday = isDateHoliday(targetDate);

                const { data: timetable } = await supabase.from('timetable_entries').select('*');

                if (timetable) {
                    for (const p of periods) {
                        let matchType = '';
                        const periodNum = p.match(/\d+/) ? p.match(/\d+/)![0] : '';

                        if (p.startsWith('주간')) matchType = 'weekday day';
                        else if (p.startsWith('야간')) matchType = isHoliday ? 'weekend night' : 'weekday night';
                        else if (p.startsWith('오전')) matchType = 'weekend morning';
                        else if (p.startsWith('오후')) matchType = 'weekend day';

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

            // Strict Validation for Outing/Overnight (Single Person Only)
            if ((leaveType === '외출' || leaveType === '외박') && addedStudents.length > 1) {
                toast.error(`${leaveType}은(는) 1인만 신청 가능합니다.`);
                return;
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
                .gte('end_time', startOfDay.toISOString())
                .gt('end_time', now.toISOString()); // Ignore past requests

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
                    .gte('end_time', startOfDay.toISOString())
                    .gt('end_time', now.toISOString()); // Ignore past requests
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
            let finalStatus = (leaveType === '외출' || leaveType === '외박') ? '학부모승인대기' : '신청';
            let finalPeriod = (leaveType === '외출' || leaveType === '외박' || leaveType === '자리비움') ? null : periods.join(',');

            if (leaveType === '컴이석' || leaveType === '이석') {
                const { data: timetable } = await supabase.from('timetable_entries').select('*');

                // Default to whole day if no timetable match found (fallback)
                let minStartTime = new Date(targetDate);
                minStartTime.setHours(0, 0, 0, 0);
                let maxEndTime = new Date(targetDate);
                maxEndTime.setHours(23, 59, 59, 999);

                if (timetable && periods.length > 0) {
                    let earliestDate = new Date(targetDate);
                    earliestDate.setHours(23, 59, 59, 999); // start with late time
                    let latestDate = new Date(targetDate);
                    latestDate.setHours(0, 0, 0, 0); // start with early time

                    let foundAny = false;
                    const isHoliday = isDateHoliday(targetDate);

                    for (const p of periods) {
                        let matchType = '';
                        const periodNum = p.match(/\d+/) ? p.match(/\d+/)![0] : '';
                        if (p.startsWith('주간')) matchType = 'weekday day';
                        else if (p.startsWith('야간')) matchType = isHoliday ? 'weekend night' : 'weekday night';
                        else if (p.startsWith('오전')) matchType = 'weekend morning';
                        else if (p.startsWith('오후')) matchType = 'weekend day';

                        const entry = timetable.find(t => {
                            const dt = t.day_type.toLowerCase();
                            const desc = t.description?.toLowerCase() || '';
                            const normalizedMatchType = matchType.toLowerCase();

                            // 1. Try exact match type
                            if (dt.includes(normalizedMatchType)) {
                                return dt.includes(periodNum) || desc.includes(periodNum);
                            }
                            return false;
                        });

                        if (entry) {
                            foundAny = true;
                            if (entry.start_time) {
                                const [hours, minutes] = entry.start_time.split(':').map(Number);
                                const d = new Date(targetDate);
                                d.setHours(hours, minutes, 0, 0);
                                if (d < earliestDate) earliestDate = d;
                            }
                            if (entry.end_time) {
                                const [hours, minutes] = entry.end_time.split(':').map(Number);
                                const d = new Date(targetDate);
                                d.setHours(hours, minutes, 59, 999);
                                if (d > latestDate) latestDate = d;
                            }
                        } else {
                            // Fallback for Weekend/Holiday if DB fails
                            // Prevents 24-hour lock
                            let startH = 0, endH = 23;
                            if (p.includes('오전') || p.includes('주간1') || p.includes('주간2') || p.includes('주간3')) {
                                startH = 9; endH = 12;
                            } else if (p.includes('오후') || p.includes('주간4') || p.includes('주간5') || p.includes('주간6')) {
                                startH = 13; endH = 17;
                            } else if (p.includes('야간')) {
                                startH = 19; endH = 23;
                            }

                            // Specific period adjustments could be added here if needed
                            // For now, grouped by time of day to ensure separation
                            if (startH !== 0 || endH !== 23) {
                                foundAny = true;
                                const s = new Date(targetDate); s.setHours(startH, 0, 0, 0);
                                const e = new Date(targetDate); e.setHours(endH, 59, 59, 999);
                                if (s < earliestDate) earliestDate = s;
                                if (e > latestDate) latestDate = e;
                            }
                        }
                    }

                    if (foundAny) {
                        minStartTime = earliestDate;
                        maxEndTime = latestDate;
                    }
                }
                finalStartTime = minStartTime.toISOString();
                finalEndTime = maxEndTime.toISOString();
                if (leaveType === '컴이석') finalStatus = '승인';

                // Check for time overlaps with existing leaves (Universal Check)
                if (existingLeaves && existingLeaves.length > 0) {
                    const newStart = minStartTime;
                    const newEnd = maxEndTime;

                    for (const exist of existingLeaves) {
                        const existStart = new Date(exist.start_time);
                        const existEnd = new Date(exist.end_time);

                        // Check time overlap: (StartA < EndB) and (EndA > StartB)
                        // Allow 1 minute buffer for consecutive period requests (since end_time has 59s padded)
                        const BUFFER = 60 * 1000;
                        if (existStart < newEnd && existEnd.getTime() > newStart.getTime() + BUFFER) {
                            toast.error(`[시간 중복] ${exist.student_id} 학생: '${exist.leave_type}'(${existStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}~${existEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})과 시간이 겹칩니다.`);
                            return;
                        }
                    }
                }
            } else if (leaveType === '자리비움') {
                const now = new Date();
                finalStartTime = now.toISOString();
                // Set end time to end of day so it persists until manually cancelled
                const eod = new Date(now);
                eod.setHours(23, 59, 59, 999);
                finalEndTime = eod.toISOString();
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

            // ---------------------------------------------------------
            // Push Notification to Teacher (New Request)
            // ---------------------------------------------------------
            if (teacherId) {
                const { data: teacherSubs } = await supabase
                    .from('push_subscriptions')
                    .select('subscription_json')
                    .eq('teacher_id', teacherId);

                if (teacherSubs && teacherSubs.length > 0) {
                    const studentName = (students.find(s => s.student_id === studentId)?.name) || studentId;
                    Promise.all(teacherSubs.map(sub =>
                        fetch('/api/web-push', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                subscription: sub.subscription_json,
                                title: '새로운 이석 신청',
                                message: `[${leaveType}] ${studentName} 학생이 신청했습니다.`
                            })
                        }).catch(e => console.error('Teacher Push Error:', e))
                    ));
                }
            }
            // ---------------------------------------------------------

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

            // Reset students list to current user only
            const loginStudent = students.find(s => s.student_id === studentId);
            if (loginStudent) {
                setAddedStudents([loginStudent]);
            }

            toast.success(leaveType === '자리비움' ? '10분간 자리비움이 승인되었습니다.' : '이석 신청이 완료되었습니다.');
        } catch (error) {
            console.error(error);
            toast.error('오류가 발생했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Generate Class Options (e.g. "1학년 1반 전체")
    const classOptions = React.useMemo(() => {
        const classes = new Set<string>();
        students.forEach(s => {
            if (s.grade && s.class) {
                classes.add(`${s.grade}-${s.class}`);
            }
        });

        return Array.from(classes).sort().map(c => {
            const [g, cl] = c.split('-');
            return {
                value: `ALL-${c}`,
                label: `------ ${g}학년 ${cl}반 전체 ------`,
                isClassOption: true,
                grade: parseInt(g),
                class: parseInt(cl),
                student: null // Dummy
            };
        });
    }, [students]);

    const studentOptions = React.useMemo(() => {
        return students
            .sort((a, b) => a.student_id.localeCompare(b.student_id))
            .map(s => ({ value: s.student_id, label: `${s.student_id} ${s.name}`, student: s }));
    }, [students]);

    const allOptions = [...classOptions, ...studentOptions];

    return (
        <div className="flex flex-col w-full max-w-xl mx-auto relative">
            <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-6 bg-yellow-400 rounded-full"></div>
                <h1 className="text-xl font-extrabold text-gray-800">이석 신청</h1>
            </div>

            <div className="flex flex-col gap-2 mb-4">
                <Select
                    instanceId="student-select"
                    isMulti
                    components={{ DropdownIndicator: CustomDropdownIndicator }}
                    value={addedStudents.map(s => ({ value: s.student_id, label: s.student_id, student: s, isFixed: s.student_id === studentId }))}
                    options={allOptions}
                    onChange={(options: any) => {
                        let newSelectedStudents: Student[] = [];

                        // 1. Check if any "Class Option" was selected just now
                        // React-Select passes the new list of selected options. 
                        // If we clicked a class option, it will be in the list.
                        // We need to process it and then REMOVE it from the final selection (replace with actual students).

                        const hasClassOption = options.find((o: any) => o.isClassOption);

                        if (hasClassOption) {
                            // Find all students in that class
                            const targetStudents = students.filter(s =>
                                s.grade === hasClassOption.grade &&
                                s.class === hasClassOption.class
                            );

                            // Merge with existing non-class options logic would be complex because `options` contains the mix.
                            // Easier strategy: Look at `options`, separate "Class Options" and "Normal Options".

                            const existingNormalSelected = options.filter((o: any) => !o.isClassOption).map((o: any) => o.student);

                            // Merge targetStudents into existing, avoiding duplicates (by student_id)
                            const mergedMap = new Map();
                            existingNormalSelected.forEach((s: Student) => mergedMap.set(s.student_id, s));
                            targetStudents.forEach(s => mergedMap.set(s.student_id, s));

                            newSelectedStudents = Array.from(mergedMap.values());

                        } else {
                            // Normal selection
                            newSelectedStudents = options ? options.map((o: any) => o.student) : [];
                        }

                        // 2. Standard Login Student & Rule Logic
                        const loginStudent = students.find(s => s.student_id === studentId);

                        // Strict Single Person Rule for Outing/Overnight
                        if (leaveType === '외출' || leaveType === '외박') {
                            if (newSelectedStudents.length > 1) {
                                toast.error('외출/외박은 1인만 신청 가능합니다.');
                            }
                            // Force reset to only login student
                            if (loginStudent) newSelectedStudents = [loginStudent];
                        } else {
                            // Helper to always keep me in the list
                            if (loginStudent && !newSelectedStudents.some((s: any) => s.student_id === studentId)) {
                                newSelectedStudents = [loginStudent, ...newSelectedStudents];
                            }
                        }
                        setAddedStudents(newSelectedStudents);
                    }}
                    styles={{
                        control: (base, state) => ({
                            ...base,
                            borderRadius: '1rem',
                            minHeight: '3rem',
                            borderColor: '#e5e7eb',
                            boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                            ':hover': { borderColor: '#fbbf24' },
                            backgroundColor: (leaveType === '외출' || leaveType === '외박' || leaveType === '자리비움') ? '#f3f4f6' : 'white', // Visual cue
                            cursor: (leaveType === '외출' || leaveType === '외박' || leaveType === '자리비움') ? 'not-allowed' : 'default',
                        }),
                        multiValue: (base) => ({ ...base, backgroundColor: '#fefce8', border: '1px solid #fde68a', borderRadius: '0.5rem', margin: '2px' }),
                        multiValueLabel: (base) => ({ ...base, color: '#854d0e', fontWeight: '600', padding: '2px 8px', fontSize: '0.875rem' }),
                        multiValueRemove: (base, { data }) => ({
                            ...base,
                            display: data.isFixed ? 'none' : 'flex',
                            ':hover': {
                                backgroundColor: '#f87171',
                                color: 'white',
                            },
                        }),
                        singleValue: (base) => ({ ...base, color: '#111827' }),
                        input: (base) => ({ ...base, color: '#111827' }),
                        placeholder: (base) => ({ ...base, color: '#6b7280' }),
                        option: (base, { isFocused, isSelected }) => ({
                            ...base,
                            backgroundColor: isSelected ? '#fbbf24' : (isFocused ? '#fef3c7' : 'white'),
                            color: isSelected ? 'white' : '#111827', // Dark text for visibility
                            cursor: 'pointer',
                            ':active': {
                                backgroundColor: '#fbbf24',
                            },
                        }),
                    }}
                    placeholder="신청자 선택 (검색 가능)"
                    isDisabled={leaveType === '외출' || leaveType === '외박' || leaveType === '자리비움'} // Disable the input entirely based on requirement
                />
            </div>

            <div className="grid grid-cols-5 gap-1 sm:gap-2 mb-4">
                {[
                    { id: '컴이석', symbol: 'Com', number: '01', color: 'blue', numColor: 'text-blue-200' },
                    { id: '이석', symbol: 'Es', number: '02', color: 'orange', numColor: 'text-orange-200' },
                    { id: '외출', symbol: 'Chul', number: '03', color: 'green', numColor: 'text-green-200' },
                    { id: '외박', symbol: 'Park', number: '04', color: 'purple', numColor: 'text-purple-200' },
                    { id: '자리비움', symbol: 'Bi', number: '10', color: 'red', numColor: 'text-red-200' },
                ].map((item) => {
                    const isActive = leaveType === item.id;

                    // Tailwind dynamic classes must be complete strings usually, but we can construct them if they are standard palette.
                    // However, to be safe and cleaner, we'll switch-case or map.
                    // Actually, let's just use the item.color prop for logic.

                    const colorClasses: any = {
                        blue: isActive ? 'bg-blue-500 border-blue-600 text-white' : 'bg-white border-blue-200 text-blue-600 hover:bg-blue-50',
                        orange: isActive ? 'bg-orange-500 border-orange-600 text-white' : 'bg-white border-orange-200 text-orange-600 hover:bg-orange-50',
                        green: isActive ? 'bg-green-500 border-green-600 text-white' : 'bg-white border-green-200 text-green-600 hover:bg-green-50',
                        purple: isActive ? 'bg-purple-500 border-purple-600 text-white' : 'bg-white border-purple-200 text-purple-600 hover:bg-purple-50',
                        red: isActive ? 'bg-red-500 border-red-600 text-white' : 'bg-white border-red-200 text-red-600 hover:bg-red-50',
                    };

                    const activeShadow = isActive ? 'shadow-md scale-[1.02]' : 'shadow-sm hover:shadow';

                    return (
                        <button
                            key={item.id}
                            onClick={() => {
                                setLeaveType(item.id);
                                setPeriods([]);
                                setTeacherId('');
                                setPlace('');
                                setReason('');
                                setStartDate(new Date());
                                setEndDate(new Date());
                                if (item.id === '외출' || item.id === '외박' || item.id === '자리비움') {
                                    const loginStudent = students.find(s => s.student_id === studentId);
                                    if (loginStudent) setAddedStudents([loginStudent]);
                                }
                            }}
                            className={clsx(
                                'relative aspect-square rounded-2xl border-2 transition-all duration-200 flex flex-col items-center justify-center p-1',
                                colorClasses[item.color],
                                activeShadow
                            )}
                        >
                            {/* Number */}
                            <span className={clsx(
                                "absolute top-1 left-2 text-[10px] font-bold opacity-80",
                                isActive ? "text-white/80" : "text-gray-400"
                            )}>
                                {item.number}
                            </span>

                            {/* Symbol */}
                            <span className={clsx(
                                "text-2xl font-black tracking-tighter sm:text-3xl mt-2 mb-1 leading-none font-sans"
                            )}>
                                {item.symbol}
                            </span>

                            {/* Full Name */}
                            <span className={clsx(
                                "text-[10px] font-bold tracking-tight opacity-90 whitespace-nowrap"
                            )}>
                                {item.id}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Unified Conditional Content Wrapper */}
            <div className={clsx(
                "grid transition-all duration-300 overflow-hidden",
                (leaveType && leaveType !== '자리비움') ? "grid-rows-[1fr] opacity-100 mb-4" : "grid-rows-[0fr] opacity-0 mb-0"
            )}>
                <div className="min-h-0 min-w-0 flex flex-col gap-4">
                    {/* Period selection for Leave/Computer Leave */}
                    {(leaveType === '컴이석' || leaveType === '이석') && (
                        <div className="flex flex-col gap-4 min-w-0">
                            <DatePicker
                                selected={targetDate}
                                onChange={(date) => { if (date) { setTargetDate(date); setPeriods([]); } }}
                                dateFormat="yyyy-MM-dd"
                                className="h-12 px-4 rounded-2xl border border-gray-200 bg-white w-full text-center shadow-sm cursor-pointer transition-all hover:border-yellow-400 font-bold text-gray-900"
                            />
                            <div className={clsx(
                                "bg-white rounded-3xl border border-gray-100 shadow-sm p-3 w-full",
                                "flex flex-row items-center justify-between gap-0.5" // Removed overflow-x-auto, added w-full behavior implicitly
                            )}>
                                {(isDateHoliday(targetDate)
                                    ? [
                                        { key: '오전', label: '오전', p: ['1', '2', '3'] },
                                        { key: '오후', label: '오후', p: ['4', '5', '6'] },
                                        { key: '야간_공휴일', label: '야간', p: ['1', '2', '3'] }
                                    ]
                                    : [
                                        { key: '주간', label: '주간', p: ['6', '7', '8', '9'] },
                                        { key: '야간', label: '야간', p: ['1', '2', '3', '4'] }
                                    ]
                                ).map((type, index, array) => {
                                    const isHoliday = isDateHoliday(targetDate);
                                    return (
                                        <div key={type.key} className="flex flex-row items-center gap-0.5 flex-1 justify-center">
                                            {/* Label Removed as per request */}
                                            {/* <span className="text-xs font-bold text-gray-500 whitespace-nowrap">{type.label}</span> */}

                                            <div className="flex flex-row gap-0.5 flex-1">
                                                {type.p.map(p => {
                                                    const label = `${type.label === '야간' ? '야간' : (type.label === '주간' ? '주간' : type.label)}${p}교시`;
                                                    const isSelected = periods.includes(label);
                                                    return (
                                                        <button
                                                            key={p}
                                                            onClick={() => togglePeriod(label)}
                                                            className={clsx(
                                                                'rounded-lg font-bold flex items-center justify-center transition-all duration-200 border flex-1',
                                                                // Use h-10/h-12 but no fixed width, let flex-1 handle it. Added min-w-0 to prevent overflow.
                                                                isHoliday
                                                                    ? 'h-9 text-xs sm:h-10 sm:text-base min-w-0 px-0'
                                                                    : 'h-10 text-sm sm:h-12 sm:text-lg min-w-0 px-0',
                                                                isSelected
                                                                    ? 'bg-yellow-400 text-white shadow-sm border-transparent transform scale-105'
                                                                    : 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100'
                                                            )}
                                                        >
                                                            {p}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {/* Visual Separator between groups */}
                                            {index < array.length - 1 && (
                                                <div className="flex items-center justify-center w-2 sm:w-4 shrink-0">
                                                    <span className="text-gray-300 font-light text-xs">/</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Date range for Outing/Overnight */}
                    {(leaveType === '외출' || leaveType === '외박') && (
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                            <DatePicker selected={startDate} onChange={setStartDate} showTimeSelect timeIntervals={10} dateFormat="yyyy-MM-dd HH:mm" className="h-12 px-4 rounded-2xl border border-gray-200 bg-white w-full shadow-sm cursor-pointer text-gray-900" />
                            <DatePicker
                                selected={endDate}
                                onChange={setEndDate}
                                showTimeSelect
                                timeIntervals={10}
                                dateFormat="yyyy-MM-dd HH:mm"
                                className="h-12 px-4 rounded-2xl border border-gray-200 bg-white w-full shadow-sm cursor-pointer text-gray-900"
                                calendarContainer={({ className, children }) => (
                                    <div className={clsx(className, "flex flex-col")}>
                                        <div className="bg-yellow-50 text-red-500 text-xs font-bold p-2 text-center border-b border-yellow-100 rounded-t-md">
                                            실제 학교에 돌아오는 시간을 설정하세요
                                        </div>
                                        <div className="relative">{children}</div>
                                    </div>
                                )}
                            />
                        </div>
                    )}

                    {/* Details for Leave/Outing/Overnight (Exclude Computer Leave/Away) */}
                    {(leaveType !== '컴이석' && leaveType !== '자리비움' && leaveType !== '') && (
                        <div className="flex flex-col gap-3">
                            <div className="relative w-full">
                                <select
                                    value={teacherId}
                                    onChange={e => setTeacherId(e.target.value)}
                                    className="h-12 px-4 rounded-2xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-sm w-full appearance-none pr-10 text-gray-900"
                                >
                                    <option value="" className="text-gray-500">지도교사 선택</option>
                                    {teachers.map(t => t.id && <option key={t.id} value={t.id} className="text-gray-900">{t.name}</option>)}
                                </select>
                                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            </div>

                            <div className="relative w-full">
                                <select
                                    value={place}
                                    onChange={e => setPlace(e.target.value)}
                                    className="h-12 px-4 rounded-2xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-sm w-full appearance-none pr-10 text-gray-900"
                                >
                                    <option value="" className="text-gray-500">이석 장소 선택</option>
                                    {leavePlaces.map(p => <option key={p} className="text-gray-900">{p}</option>)}
                                </select>
                                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            </div>
                            <input type="text" value={reason} onChange={e => setReason(e.target.value)} className="h-12 px-4 rounded-2xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-sm w-full text-gray-900" placeholder="이석 사유" />
                        </div>
                    )}
                </div>
            </div>

            <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={clsx(
                    "h-14 rounded-2xl font-bold text-lg shadow-md transition-all mb-8 flex items-center justify-center gap-2",
                    isSubmitting
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-gradient-to-r from-yellow-400 to-orange-500 text-white hover:shadow-lg transform active:scale-95"
                )}
            >
                {isSubmitting && <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>}
                {isSubmitting ? '신청 중...' : '신청'}
            </button>
        </div>
    );
};
