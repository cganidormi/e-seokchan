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

interface LeaveRequest {
  id: number;
  student_id: string;
  leave_type: string;
  period: string;
  place: string;
  reason: string;
  status: string;
  start_time: string;
  end_time: string;
  teacher_id: string;
  teachers?: {
    name: string;
  };
  leave_request_students?: {
    student_id: string;
  }[];
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

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);


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

    if (loginId) fetchLeaveRequests(loginId);
  }, []);

  const fetchLeaveRequests = async (id: string) => {
    try {
      // 1. 기본 leave_requests 데이터만 가져오기 (JOIN 없이)
      const { data: leaveData, error: leaveError } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('student_id', id)
        .neq('status', '취소')
        .order('created_at', { ascending: false });

      if (leaveError) {
        console.error('Leave requests fetch error:', leaveError);
        return;
      }

      if (!leaveData || leaveData.length === 0) {
        setLeaveRequests([]);
        return;
      }

      // 2. 모든 teacher 정보 가져오기
      const { data: teachersData } = await supabase
        .from('teachers')
        .select('id, name');

      // 3. 각 leave_request에 대한 추가 학생 및 teacher 정보 병합
      const requestsWithDetails = await Promise.all(
        leaveData.map(async (req) => {
          // 추가 학생 정보
          const { data: additionalStudents } = await supabase
            .from('leave_request_students')
            .select('student_id')
            .eq('leave_request_id', req.id);

          // Teacher 정보 매칭
          const teacher = teachersData?.find(t => t.id === req.teacher_id);

          return {
            ...req,
            teachers: teacher ? { name: teacher.name } : null,
            leave_request_students: additionalStudents || []
          };
        })
      );

      console.log('Fetched leave requests with details:', requestsWithDetails);
      setLeaveRequests(requestsWithDetails as any[]);
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  const togglePeriod = (p: string) => {
    setPeriods(prev =>
      prev.includes(p) ? prev.filter(v => v !== p) : [...prev, p]
    );
  };



  const handleAddStudent = (student: Student) => {
    if (!addedStudents.find(s => s.student_id === student.student_id)) {
      setAddedStudents([...addedStudents, student]);
    }
  };

  const handleRemoveStudent = (studentId: string) => {
    setAddedStudents(prev => prev.filter(s => s.student_id !== studentId));
  };

  const handleCancelRequest = async (requestId: number) => {
    if (!confirm('신청을 취소하시겠습니까?')) return;

    const { error } = await supabase
      .from('leave_requests')
      .update({ status: '취소' })
      .eq('id', requestId);

    if (error) {
      toast.error('취소 실패');
    } else {
      toast.success('취소되었습니다.');
      fetchLeaveRequests(studentId);
    }
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
        status: leaveType === '컴이석' ? '승인' : '신청',
      }])
      .select()
      .single();

    if (leaveError || !leaveData) {
      toast.error('신청자 저장 실패');
      return;
    }

    // 추가학생 처리
    const leaveRequestId = leaveData.id;
    const additionalStudents = addedStudents.filter(s => s.student_id !== studentId);
    console.log('Additional students to save:', additionalStudents);
    console.log('Leave request ID:', leaveRequestId);

    if (additionalStudents.length > 0) {
      const { error } = await supabase.from('leave_request_students').insert(
        additionalStudents.map(s => ({
          leave_request_id: leaveRequestId,
          student_id: s.student_id,
        }))
      );
      if (error) {
        console.error('Additional students insert error:', error);
        toast.error('추가 학생 저장 실패');
        return;
      }
      console.log('Additional students saved successfully');
    }

    // 현황 다시 불러오기 (추가 학생 저장 후 실행)
    fetchLeaveRequests(studentId);

    // 로그인 학생 제외 후 나머지 학생 리셋
    setAddedStudents(prev => prev.filter(s => s.student_id === studentId));

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

      <div className="flex flex-col w-full max-w-xl mx-auto relative">
        {/* 신청자 */}
        <div className="flex flex-col gap-2 mb-3">
          <span>신청자</span>

          <Select
            instanceId="student-select"
            isMulti={true}
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
                ? (Array.isArray(options) ? options.map((o: any) => o.student) : [options.student])
                : [];

              // 로그인 학생은 항상 포함 (중복 방지)
              const loginStudent = students.find(s => s.student_id === studentId);
              if (loginStudent) {
                const alreadyIncluded = selected.some((s: Student) => s.student_id === studentId);
                if (!alreadyIncluded) {
                  selected = [loginStudent, ...selected];
                }
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
        <div className="grid grid-cols-5 gap-2 mb-3">
          {leaveTypes.map((t) => (
            <button
              key={t}
              onClick={() => {
                setLeaveType(t);
                // 모든 입력 필드 초기화
                setPeriods([]);
                setTeacherId('');
                setPlace('');
                setReason('');
                setStartDate(new Date());
                setEndDate(new Date());

                // 외출/외박/자리비움 전환 시 본인 외 선택 해제
                if (t === '외출' || t === '외박' || t === '자리비움') {
                  const loginStudent = students.find(s => s.student_id === studentId);
                  if (loginStudent) setAddedStudents([loginStudent]);
                }
              }}
              className={clsx(
                'h-12 rounded-2xl shadow-sm border transition-all duration-200 active:scale-95 font-medium w-full flex items-center justify-center',
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
        <div className={clsx(
          "grid transition-all duration-300 ease-in-out overflow-hidden",
          (leaveType === '컴이석' || leaveType === '이석') ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}>
          <div className="min-h-0">
            {(() => {
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
                <div className="flex flex-col gap-4 pb-3">
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
                      portalId="datepicker-portal"
                      className="h-12 px-4 rounded-2xl border border-gray-200 bg-white w-full outline-none focus:outline-none hover:border-yellow-400 focus:border-yellow-400 font-bold text-center shadow-sm cursor-pointer transition-all"
                    />
                  </div>

                  <div className={clsx(
                    "bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden",
                    isWeekend ? "grid grid-cols-3 divide-x divide-gray-100" : "flex flex-col p-4 gap-4"
                  )}>
                    {typeConfigs.map((type, idx) => (
                      <div
                        key={type.key}
                        className={clsx(
                          "flex flex-col gap-2",
                          isWeekend ? "p-2 w-full" : "w-full"
                        )}
                      >
                        <div className="flex items-center gap-2 px-1">
                          <div className="w-1 h-4 bg-yellow-400 rounded-full"></div>
                          <span className="text-sm font-bold text-gray-700 whitespace-nowrap">{type.label} 교시</span>
                        </div>

                        <div className={clsx(
                          "flex gap-1.5",
                          isWeekend ? "flex-nowrap" : "flex-wrap"
                        )}>
                          {type.periods.map(p => {
                            const periodLabel = `${type.label}${p}교시`;
                            const isSelected = periods.includes(periodLabel);
                            return (
                              <button
                                key={p}
                                onClick={() => togglePeriod(periodLabel)}
                                className={clsx(
                                  'w-10 h-10 rounded-xl text-sm font-bold transition-all duration-200 border shadow-sm flex items-center justify-center',
                                  isSelected
                                    ? 'bg-yellow-400 text-white border-yellow-400 scale-105'
                                    : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100 hover:border-gray-200'
                                )}
                              >
                                {p}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>




        {/* 시간 / 외출 외박 */}
        <div className={clsx(
          "grid transition-all duration-300 ease-in-out overflow-hidden",
          (leaveType === '외출' || leaveType === '외박') ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}>
          <div className="min-h-0">
            <div className="flex flex-col md:flex-row justify-between gap-4 md:gap-0 pb-3">
              <div className="w-full md:w-[48%]">
                <DatePicker
                  selected={startDate}
                  onChange={setStartDate}
                  showTimeSelect
                  timeIntervals={10}
                  dateFormat="yyyy-MM-dd HH:mm"
                  portalId="datepicker-portal"
                  className="h-12 px-4 rounded-2xl border border-gray-200 bg-white w-full outline-none focus:outline-none hover:border-yellow-400 focus:border-yellow-400 shadow-sm cursor-pointer transition-all"
                />
              </div>
              <div className="w-full md:w-[48%]">
                <DatePicker
                  selected={endDate}
                  onChange={setEndDate}
                  showTimeSelect
                  timeIntervals={10}
                  dateFormat="yyyy-MM-dd HH:mm"
                  portalId="datepicker-portal"
                  className="h-12 px-4 rounded-2xl border border-gray-200 bg-white w-full outline-none focus:outline-none hover:border-yellow-400 focus:border-yellow-400 shadow-sm cursor-pointer transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 지도교사 / 장소 / 사유 */}
        <div className={clsx(
          "grid transition-all duration-300 ease-in-out overflow-hidden",
          leaveType !== '컴이석' ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}>
          <div className="min-h-0">
            <div className="flex flex-col gap-3 pb-3">
              <select onChange={e => setTeacherId(e.target.value)} className="h-12 px-4 rounded-2xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent shadow-sm appearance-none cursor-pointer transition-all w-full">
                <option value="">지도교사</option>
                {teachers.map(t => (
                  t.id && <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>

              <select onChange={e => setPlace(e.target.value)} className="h-12 px-4 rounded-2xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent shadow-sm appearance-none cursor-pointer transition-all w-full">
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
            </div>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          className="h-14 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold text-lg shadow-md hover:shadow-lg transform active:scale-95 transition-all duration-200 mb-8"
        >
          신청
        </button>

        {/* 이석현황 섹션 */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-6 bg-yellow-400 rounded-full"></div>
            <h2 className="text-xl font-extrabold text-gray-800">이석현황</h2>
          </div>

          <div className="flex flex-col gap-3">
            {leaveRequests.length === 0 ? (
              <div className="bg-[#1a1a1a] p-6 rounded-[2rem] border border-dashed border-white/10 text-center text-gray-500 font-bold text-sm">
                신청 내역이 없습니다.
              </div>
            ) : (
              leaveRequests.map((req) => {
                const statusConfig = {
                  '신청': { dot: 'bg-amber-500', text: 'text-amber-500', label: '대기' },
                  '승인': { dot: 'bg-green-500', text: 'text-green-500', label: '승인' },
                  '반려': { dot: 'bg-red-500', text: 'text-red-500', label: '반려' },
                  '취소': { dot: 'bg-gray-500', text: 'text-gray-500', label: '취소' },
                }[req.status] || { dot: 'bg-gray-500', text: 'text-gray-500', label: req.status };

                const additionalIds = req.leave_request_students?.map(lrs => lrs.student_id).filter(Boolean) || [];
                const allStudents = [req.student_id, ...additionalIds].filter(Boolean);

                const isExpanded = expandedId === req.id;

                return (
                  <div
                    key={req.id}
                    onClick={() => setExpandedId(isExpanded ? null : req.id)}
                    className={clsx(
                      "bg-[#1a1a1a] border border-white/5 shadow-2xl transition-all cursor-pointer hover:bg-[#222] overflow-hidden",
                      isExpanded ? "rounded-[2rem] p-6" : "rounded-full py-3 px-6 h-auto"
                    )}
                  >
                    {/* Main Row: Optimized for a single elliptical line */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-black tracking-tight w-full">

                      {/* 1. 이석종류 / 승인상태 */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className={clsx("w-1.5 h-1.5 rounded-full animate-pulse", statusConfig.dot)}></div>
                        <span className="text-white text-sm whitespace-nowrap">{req.leave_type}</span>
                        {req.leave_type !== '컴이석' && (
                          <span className={clsx("px-2 py-0.5 rounded-full border border-opacity-30 border-current text-[10px]", statusConfig.text)}>
                            {statusConfig.label}
                          </span>
                        )}
                      </div>

                      {/* 2. 신청자 */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        {allStudents.map((studentId, idx) => (
                          <span key={idx} className="text-gray-200 text-[11px] leading-tight">
                            {studentId}
                          </span>
                        ))}
                      </div>

                      {/* 3. 시작시간 / 4. 종료시간 OR 교시 */}
                      <div className="flex items-center gap-2 shrink-0">
                        {req.period ? (
                          // 교시 기반 이석 (컴이석, 이석)
                          <>
                            <span className="text-yellow-400 font-bold">
                              {req.period.split(',').join(', ')}
                            </span>
                            <span className="text-gray-500 opacity-60 ml-1">
                              ({new Date(req.start_time).toLocaleDateString([], { month: 'numeric', day: 'numeric' })})
                            </span>
                          </>
                        ) : (
                          // 시간 기반 이석 (외출, 외박)
                          <>
                            <div className="flex items-center">
                              <span className="text-white">
                                <span className="text-yellow-400">
                                  {new Date(req.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                </span>
                              </span>
                            </div>
                            <span className="text-gray-600 font-normal">~</span>
                            <div className="flex items-center">
                              <span className="text-white">
                                <span className="text-orange-400">
                                  {new Date(req.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                </span>
                              </span>
                            </div>
                            <span className="text-gray-500 opacity-60 ml-1">
                              ({new Date(req.start_time).toLocaleDateString([], { month: 'numeric', day: 'numeric' })})
                            </span>
                          </>
                        )}
                      </div>


                      {/* Quick Summary or Cancel for unexpanded */}
                      {!isExpanded && (
                        <div className="ml-auto flex items-center gap-3">
                          {/* 5. 이석사유 (컴이석 제외, 한줄 마지막으로 이동) */}
                          {req.leave_type !== '컴이석' && (
                            <div className="hidden sm:flex items-center max-w-[150px]">
                              <span className="text-gray-400 truncate italic">"{req.reason || '없음'}"</span>
                            </div>
                          )}

                          {(req.status === '신청' || (req.status === '승인' && req.leave_type === '컴이석')) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCancelRequest(req.id); }}
                              className="text-red-500 hover:text-red-400 font-black underline underline-offset-2 shrink-0"
                            >
                              신청 취소
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Expanded Detail View */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-white/5 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {req.leave_type !== '컴이석' && (
                            <div className="flex flex-col gap-2">
                              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">이석 상세 사유</span>
                              <p className="text-sm text-gray-300 italic leading-relaxed">"{req.reason || '입력된 사유가 없습니다.'}"</p>
                            </div>
                          )}
                          <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">모든 신청자</span>
                            <div className="flex flex-wrap gap-2">
                              {allStudents.map(name => (
                                <span key={name} className="px-3 py-1 bg-white/5 rounded-lg text-xs text-gray-200 font-bold">{name}</span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {req.leave_type !== '컴이석' && (
                            <>
                              <div className="bg-white/5 rounded-2xl p-3 flex flex-col gap-1">
                                <span className="text-[9px] font-black text-gray-500 uppercase">지도교사</span>
                                <span className="text-xs text-white font-black">{req.teachers?.name || '미지정'}</span>
                              </div>
                              <div className="bg-white/5 rounded-2xl p-3 flex flex-col gap-1">
                                <span className="text-[9px] font-black text-gray-500 uppercase">이석 장소</span>
                                <span className="text-xs text-white font-black">{req.place || '미지정'}</span>
                              </div>
                            </>
                          )}
                          <div className="bg-white/5 rounded-2xl p-3 flex flex-col gap-1 group">
                            <span className="text-[9px] font-black text-gray-500 uppercase group-hover:text-amber-500 transition-colors">신청 일시</span>
                            <span className="text-[10px] text-gray-300 font-medium">관리번호 #{req.id}</span>
                          </div>
                          <div className="flex items-center">
                            {(req.status === '신청' || (req.status === '승인' && req.leave_type === '컴이석')) && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCancelRequest(req.id); }}
                                className="w-full h-full rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-black transition-all"
                              >
                                신청 취소
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
