'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import Select from 'react-select';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import toast, { Toaster } from 'react-hot-toast';
import clsx from 'clsx';

interface Teacher {
  id: string;
  name: string;
}

interface Student {
  student_id: string;
  name: string;
  grade: number;
  class: number;
}

export default function LeaveRequestForm() {
  const leaveTypes = ['컴이석', '이석', '외출', '외박', '자리비움'];
  const leavePlaces = ['교실', '도서관', '식당', '기타'];

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  const [studentId, setStudentId] = useState(''); // 로그인 학생
  const [addedStudents, setAddedStudents] = useState<Student[]>([]); // 신청자 목록
  const [leaveType, setLeaveType] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [place, setPlace] = useState('');
  const [reason, setReason] = useState('');

  const [dayType, setDayType] = useState<'주간' | '야간'>('주간');
  const [periods, setPeriods] = useState<string[]>([]);

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const periodOptions = {
    주간: ['1교시','2교시','3교시','4교시','5교시','6교시','7교시','8교시','9교시'],
    야간: ['1교시','2교시','3교시','4교시'],
  };

  useEffect(() => {
    // 🔑 로그인 학생 ID 가져오기
    const loginId = localStorage.getItem('dormichan_login_id');
    if (loginId) setStudentId(loginId);

    // 학생 리스트 불러오기
    supabase.from('students').select('*').then(({ data }) => {
      if (data) {
        setStudents(data as Student[]);

        // 로그인 학생 자동 추가
        if (loginId) {
          const loginStudent = data.find(s => s.student_id === loginId);
          if (loginStudent) setAddedStudents([loginStudent]);
        }
      }
    });

    // 교사 리스트 불러오기
    supabase.from('teachers').select('id, name').then(({ data }) => {
      if (data) setTeachers(data as Teacher[]);
    });
  }, []);

  const togglePeriod = (p: string) => {
    setPeriods(prev =>
      prev.includes(p) ? prev.filter(v => v !== p) : [...prev, p]
    );
  };

  const changeDayType = (type: '주간' | '야간') => {
    setDayType(type);
    setPeriods([]);
  };

  const handleAddStudent = (student: Student) => {
    if (!addedStudents.find(s => s.student_id === student.student_id)) {
      setAddedStudents([...addedStudents, student]);
    }
  };

  const handleRemoveStudent = (studentId: string) => {
    setAddedStudents(prev => prev.filter(s => s.student_id !== studentId));
  };

  const handleSubmit = async () => {
    if (
      !studentId ||
      !leaveType ||
      ((leaveType === '컴이석' || leaveType === '이석') && periods.length === 0) ||
      ((leaveType === '외출' || leaveType === '외박') && (!startDate || !endDate))
    ) {
      toast.error('필수 항목을 모두 입력하세요.');
      return;
    }

    const { data: leaveData, error: leaveError } = await supabase.from('leave_requests').insert([{
      student_id: studentId,
      leave_type: leaveType,
      teacher_id: leaveType === '컴이석' ? null : teacherId,
      place: leaveType === '컴이석' ? null : place,
      reason: leaveType === '컴이석' ? null : reason,
      period: periods.join(','),
      start_time: startDate?.toISOString(),
      end_time: endDate?.toISOString(),
      status: '신청',
    }]).select().single();

    if (leaveError || !leaveData) {
      toast.error('신청자 저장 실패');
      return;
    }

    const leaveRequestId = leaveData.id;

    const additionalStudents = addedStudents.filter(s => s.student_id !== studentId);
    if (additionalStudents.length > 0) {
      const { error } = await supabase.from('leave_request_students').insert(
        additionalStudents.map(s => ({
          leave_request_id: leaveRequestId,
          student_id: s.student_id,
        }))
      );
      if (error) {
        toast.error('추가 학생 저장 실패');
        return;
      }
    }

    toast.success('이석 신청 완료!');
    // 초기화
    setLeaveType('');
    setTeacherId('');
    setPlace('');
    setReason('');
    setPeriods([]);
    setStartDate(null);
    setEndDate(null);
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <Toaster />
      <h1 className="text-2xl font-bold mb-6">이석 신청</h1>

      <div className="flex flex-col gap-5 max-w-xl">
        {/* 신청자 */}
        <div className="flex flex-col gap-2">
          <span>신청자</span>
          <div className="flex flex-wrap gap-2">
            {addedStudents.map(s => (
              <div key={s.student_id} className="flex items-center bg-gray-200 p-1 px-2 rounded-xl">
                {s.name} ({s.student_id})
                {s.student_id !== studentId && (
                  <button onClick={() => handleRemoveStudent(s.student_id)} className="ml-2 text-red-500 font-bold">×</button>
                )}
              </div>
            ))}
          </div>
          <Select
            options={students.filter(s => s.student_id !== studentId).map(s => ({
              value: s.student_id,
              label: `${s.name} (${s.student_id})`,
              student: s
            }))}
            onChange={(option: any) => handleAddStudent(option.student)}
            placeholder="학생 추가 (검색 가능)"
            isClearable
          />
        </div>

        {/* 이석 종류 */}
        <div className="flex gap-2">
          {leaveTypes.map((t) => (
            <button
              key={t}
              onClick={() => setLeaveType(t)}
              className={clsx(
                'flex-1 p-2 rounded-xl shadow',
                leaveType === t ? 'bg-yellow-400 text-white' : 'bg-gray-200'
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* 교시 선택 */}
        {(leaveType === '컴이석' || leaveType === '이석') && (
          <div className="space-y-3">
            <div className="flex gap-2">
              {(['주간','야간'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => changeDayType(d)}
                  className={clsx('flex-1 p-2 rounded-xl', dayType === d ? 'bg-yellow-400 text-white' : 'bg-gray-200')}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className={clsx('flex gap-2 flex-wrap', dayType === '야간' ? 'mt-1' : '')}>
              {periodOptions[dayType].map(p => (
                <button
                  key={p}
                  onClick={() => togglePeriod(p)}
                  className={clsx('px-2 py-1 text-sm rounded-lg',
                    periods.includes(p) ? 'bg-yellow-400 text-white' : 'bg-gray-200')}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 시간 / 외출 외박 */}
        {(leaveType === '외출' || leaveType === '외박') && (
          <div className="flex justify-between">
            <div className="w-[48%]">
              <DatePicker
                selected={startDate}
                onChange={setStartDate}
                showTimeSelect
                showTimeSelectOnly={leaveType === '외출'}
                timeIntervals={10}
                dateFormat={leaveType === '외출' ? 'HH:mm' : 'yyyy-MM-dd HH:mm'}
                className="p-2 rounded-xl bg-gray-200 w-full"
              />
            </div>
            <div className="w-[48%]">
              <DatePicker
                selected={endDate}
                onChange={setEndDate}
                showTimeSelect
                showTimeSelectOnly={leaveType === '외출'}
                timeIntervals={10}
                dateFormat={leaveType === '외출' ? 'HH:mm' : 'yyyy-MM-dd HH:mm'}
                className="p-2 rounded-xl bg-gray-200 w-full"
              />
            </div>
          </div>
        )}

        {/* 지도교사 / 장소 / 사유 */}
        {leaveType !== '컴이석' && (
          <>
            <select onChange={e => setTeacherId(e.target.value)} className="p-2 rounded-xl bg-gray-200">
              <option value="">지도교사</option>
              {teachers.map(t => (
                t.id && <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            <select onChange={e => setPlace(e.target.value)} className="p-2 rounded-xl bg-gray-200">
              <option value="">이석 장소</option>
              {leavePlaces.map(p => (
                <option key={p}>{p}</option>
              ))}
            </select>

            <textarea
              onChange={e => setReason(e.target.value)}
              className="p-2 rounded-xl bg-gray-200"
              placeholder="이석 사유"
            />
          </>
        )}

        <button
          onClick={handleSubmit}
          className="p-3 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold"
        >
          신청
        </button>
      </div>
    </div>
  );
}
