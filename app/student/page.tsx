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
  const [leaveType, setLeaveType] = useState('컴이석');
  const [teacherId, setTeacherId] = useState('');
  const [place, setPlace] = useState('');
  const [reason, setReason] = useState('');

  const [dayType, setDayType] = useState<'주간' | '야간'>('주간');
  const [periods, setPeriods] = useState<string[]>([]);

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [targetDate, setTargetDate] = useState<Date>(new Date());

  const periodOptions = {
    주간: ['1교시', '2교시', '3교시', '4교시', '5교시', '6교시', '7교시', '8교시', '9교시'],
    야간: ['1교시', '2교시', '3교시', '4교시'],
    오전: ['1교시', '2교시', '3교시'],
    오후: ['1교시', '2교시', '3교시'],
    야간_공휴일: ['1교시', '2교시', '3교시'],
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

    // 중복 교시 체크
    if (leaveType === '이석' || leaveType === '컴이석') {
      // 선택된 날짜의 범위설정 (00:00 ~ 23:59)
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: existingLeaves } = await supabase
        .from('leave_requests')
        .select('period')
        .eq('student_id', studentId)
        .eq('status', '신청')
        .gte('start_time', startOfDay.toISOString())
        .lte('end_time', endOfDay.toISOString());

      const existingPeriods = existingLeaves?.flatMap(l => l.period?.split(',') || []) || [];
      const duplicate = periods.some(p => existingPeriods.includes(p));
      if (duplicate) {
        toast.error('이미 신청된 교시가 있습니다.');
        return;
      }
    }

    const { data: leaveData, error: leaveError } = await supabase
      .from('leave_requests')
      .insert([{
        student_id: studentId,
        leave_type: leaveType,
        teacher_id: leaveType === '컴이석' ? null : teacherId,
        place: leaveType === '컴이석' ? null : place,
        reason: leaveType === '컴이석' ? null : reason,
        period: periods.join(','),
        start_time: (leaveType === '컴이석' || leaveType === '이석') ? targetDate.toISOString() : startDate?.toISOString(),
        end_time: (leaveType === '컴이석' || leaveType === '이석') ? targetDate.toISOString() : endDate?.toISOString(),
        status: '신청',
      }])
      .select()
      .single();

    if (leaveError || !leaveData) {
      toast.error('신청자 저장 실패');
      return;
    }

    // 로그인 학생 제외 후 나머지 학생 리셋
    setAddedStudents(prev => prev.filter(s => s.student_id === studentId));

    // 추가학생 처리
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

    // 필드 초기화
    setLeaveType('');
    setTeacherId('');
    setPlace('');
    setReason('');
    setPeriods([]);
    setStartDate(null);
    setEndDate(null);

    toast.success('이석 신청이 완료되었습니다.');
  };


  return (
    <div className="p-4 md:p-6 bg-gray-100 min-h-screen">
      <Toaster />
      <h1 className="text-2xl font-bold mb-6">이석 신청</h1>

      <div className="flex flex-col gap-3 max-w-xl">
        {/* 신청자 */}
        <div className="flex flex-col gap-2">
          <span>신청자</span>

          <Select
            isMulti={leaveType === '컴이석' || leaveType === '이석'}
            value={addedStudents.map(s => ({
              value: s.student_id,
              label: s.student_id,
              student: s,
            }))}
            options={students.map(s => ({
              value: s.student_id,
              label: s.student_id,
              student: s,
            }))}
            onChange={(options: any) => {
              let selected = options
                ? options.map((o: any) => o.student)
                : [];

              // 로그인 학생은 항상 포함
              const loginStudent = students.find(s => s.student_id === studentId);
              if (loginStudent && !selected.find((s: Student) => s.student_id === studentId)) {
                selected = [loginStudent, ...selected];
              }

              setAddedStudents(selected);
            }}
            styles={{
              control: (base) => ({
                ...base,
                borderRadius: '1rem', // rounded-2xl
                padding: '0.25rem',
                borderColor: '#e5e7eb', // gray-200
                boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)', // shadow-sm
                ':hover': { borderColor: '#fbbf24' }, // yellow-400
              }),
              multiValue: (base) => ({
                ...base,
                backgroundColor: '#fefce8', // yellow-50
                border: '1px solid #fde68a', // yellow-200
                borderRadius: '0.5rem',
                margin: '2px',
              }),
              multiValueLabel: (base) => ({
                ...base,
                color: '#854d0e', // yellow-900
                fontWeight: '600',
                padding: '2px 8px',
                fontSize: '0.875rem',
              }),
              multiValueRemove: (base) => ({
                ...base,
                color: '#a16207', // yellow-700
                borderRadius: '0 0.5rem 0.5rem 0',
                ':hover': {
                  backgroundColor: '#fef3c7', // yellow-100
                  color: '#854d0e',
                },
              }),
              singleValue: (base) => ({
                ...base,
                backgroundColor: '#fefce8', // yellow-50
                border: '1px solid #fde68a', // yellow-200
                borderRadius: '0.5rem',
                padding: '2px 8px',
                color: '#854d0e', // yellow-900
                fontWeight: '600',
                fontSize: '0.875rem',
                width: 'fit-content',
                margin: '2px',
              }),
            }}
            placeholder="신청자 선택 (검색 가능)"
            classNamePrefix="react-select"
          />
        </div>


        {/* 이석 종류 */}
        <div className="flex gap-2">
          {leaveTypes.map((t) => (
            <button
              key={t}
              onClick={() => {
                setLeaveType(t);
                // 외출/외박/자리비움 전환 시 본인 외 선택 해제
                if (t === '외출' || t === '외박' || t === '자리비움') {
                  const loginStudent = students.find(s => s.student_id === studentId);
                  if (loginStudent) setAddedStudents([loginStudent]);
                }
              }}
              className={clsx(
                'flex-1 h-12 rounded-2xl shadow-sm border transition-all duration-200 active:scale-95 font-medium',
                leaveType === t
                  ? 'bg-yellow-400 text-white border-yellow-400 shadow-md font-bold'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* 교시 선택 */}
        {(leaveType === '컴이석' || leaveType === '이석') && (() => {
          const day = targetDate.getDay(); // 0:일, 6:토
          const isWeekend = day === 0 || day === 6;

          const typeConfigs = isWeekend
            ? [
              { key: '오전', label: '오전', periods: ['1', '2', '3'] },
              { key: '오후', label: '오후', periods: ['1', '2', '3'] },
              { key: '야간_공휴일', label: '야간', periods: ['1', '2', '3'] },
            ]
            : [
              { key: '주간', label: '주간', periods: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] },
              { key: '야간', label: '야간', periods: ['1', '2', '3', '4'] },
            ];

          return (
            <div className="flex flex-col gap-3">
              <div className="w-full">
                <DatePicker
                  selected={targetDate}
                  onChange={(date) => {
                    if (date) {
                      setTargetDate(date);
                      setPeriods([]); // 날짜 변경시 선택된 교시 초기화
                    }
                  }}
                  dateFormat="yyyy-MM-dd"
                  className="h-12 px-4 rounded-2xl border border-gray-200 bg-white w-full outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent font-bold text-center shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
                />
              </div>

              <div className="flex gap-3">
                {typeConfigs.map(type => (
                  <div key={type.key} className="flex-1">
                    {/* 상위 버튼 */}
                    <button
                      onClick={() => {
                        setDayType(type.key as any);
                        setPeriods([]);
                      }}
                      className={clsx(
                        'w-full h-12 rounded-2xl mb-2 font-medium shadow-sm border transition-all duration-200',
                        dayType === type.key
                          ? 'bg-yellow-400 text-white border-yellow-400 font-bold'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      )}
                    >
                      {type.label}
                    </button>

                    {/* 교시 버튼 (선택된 경우만 표시) */}
                    {dayType === type.key && (
                      <div className="flex gap-1 justify-center flex-nowrap">
                        {type.periods.map(p => (
                          <button
                            key={p}
                            onClick={() => togglePeriod(`${type.label}${p}교시`)}
                            className={clsx(
                              'w-10 h-10 rounded-xl text-sm font-medium shadow-sm border transition-all duration-200',
                              periods.includes(`${type.label}${p}교시`)
                                ? 'bg-yellow-400 text-white border-yellow-400 font-bold'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            )}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}




        {/* 시간 / 외출 외박 */}
        {(leaveType === '외출' || leaveType === '외박') && (
          <div className="flex flex-col md:flex-row justify-between gap-4 md:gap-0">
            <div className="w-full md:w-[48%]">
              <DatePicker
                selected={startDate}
                onChange={setStartDate}
                showTimeSelect
                timeIntervals={10}
                dateFormat="yyyy-MM-dd HH:mm"
                className="h-12 px-4 rounded-2xl border border-gray-200 bg-white w-full outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent shadow-sm cursor-pointer transition-all"
              />
            </div>
            <div className="w-full md:w-[48%]">
              <DatePicker
                selected={endDate}
                onChange={setEndDate}
                showTimeSelect
                timeIntervals={10}
                dateFormat="yyyy-MM-dd HH:mm"
                className="h-12 px-4 rounded-2xl border border-gray-200 bg-white w-full outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent shadow-sm cursor-pointer transition-all"
              />
            </div>
          </div>
        )}

        {/* 지도교사 / 장소 / 사유 */}
        {leaveType !== '컴이석' && (
          <>
            <select onChange={e => setTeacherId(e.target.value)} className="h-12 px-4 rounded-2xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent shadow-sm appearance-none cursor-pointer transition-all">
              <option value="">지도교사</option>
              {teachers.map(t => (
                t.id && <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            <select onChange={e => setPlace(e.target.value)} className="h-12 px-4 rounded-2xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent shadow-sm appearance-none cursor-pointer transition-all">
              <option value="">이석 장소</option>
              {leavePlaces.map(p => (
                <option key={p}>{p}</option>
              ))}
            </select>

            <input
              type="text"
              onChange={e => setReason(e.target.value)}
              className="h-12 px-4 rounded-2xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent shadow-sm w-full transition-all"
              placeholder="이석 사유"
            />
          </>
        )}

        <button
          onClick={handleSubmit}
          className="h-14 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold text-lg shadow-md hover:shadow-lg transform active:scale-95 transition-all duration-200"
        >
          신청
        </button>
      </div>
    </div>
  );
}
