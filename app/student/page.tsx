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
  created_at: string; // FIX: 신청일시 필드 추가
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
  const [viewMode, setViewMode] = useState<'active' | 'past'>('active');
  const [filterType, setFilterType] = useState('전체');


  const [periods, setPeriods] = useState<string[]>([]);

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [targetDate, setTargetDate] = useState<Date>(new Date());

  const periodOptions = {
    주간: ['1교시', '2교시', '3교시', '4교시', '5교시', '6교시', '7교시', '8교시', '9교시'],
    야간: ['1교시', '2교시', '3교시', '4교시'],
    오전: ['1교시', '2교시', '3교시'],
    오후: ['4교시', '5교시', '6교시'],
    야간_공휴일: ['1교시', '2교시', '3교시'],
  };

  useEffect(() => {
    // 🔑 로그인 학생 ID 가져오기
    const loginId = localStorage.getItem('dormichan_login_id') || sessionStorage.getItem('dormichan_login_id');
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

    if (loginId) {
      fetchLeaveRequests(loginId);

      // 🔑 실시간 구독 추가
      const channel = supabase
        .channel('leave_requests_student')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'leave_requests' },
          () => {
            console.log('Realtime update detected, refetching...');
            fetchLeaveRequests(loginId);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, []);

  const fetchLeaveRequests = async (id: string) => {
    try {
      // 1. 내가 신청자인 경우와 추가 신청자로 등록된 경우를 모두 가져오기
      // 1-1. 내가 메인 신청자인 이석들
      const { data: mainRequests, error: mainError } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('student_id', id)
        .neq('status', '취소');

      if (mainError) throw mainError;

      // 1-2. 내가 추가 신청자인 이석 ID들 가져오기
      const { data: coStudentData, error: coError } = await supabase
        .from('leave_request_students')
        .select('leave_request_id')
        .eq('student_id', id);

      if (coError) throw coError;

      const coRequestIds = coStudentData?.map(c => c.leave_request_id) || [];

      // 1-3. 추가 신청자로 등록된 이석 정보 가져오기
      let coRequests: any[] = [];
      if (coRequestIds.length > 0) {
        const { data: fetchedCoRequests, error: fetchCoError } = await supabase
          .from('leave_requests')
          .select('*')
          .in('id', coRequestIds)
          .neq('status', '취소');

        if (fetchCoError) throw fetchCoError;
        coRequests = fetchedCoRequests || [];
      }

      // 두 목록 합치기 및 중복 제거 (혹시 모를)
      const allRequestIds = new Set([...(mainRequests?.map(r => r.id) || []), ...coRequests.map(r => r.id)]);
      const combinedRequests = [...(mainRequests || []), ...coRequests].filter(r => {
        if (allRequestIds.has(r.id)) {
          allRequestIds.delete(r.id);
          return true;
        }
        return false;
      });

      // 작성일 기준 정렬
      combinedRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      if (combinedRequests.length === 0) {
        setLeaveRequests([]);
        return;
      }

      // 2. 모든 teacher 정보 가져오기
      const { data: teachersData } = await supabase
        .from('teachers')
        .select('id, name');

      // 3. 각 leave_request에 대한 추가 학생 및 teacher 정보 병합
      const requestsWithDetails = await Promise.all(
        combinedRequests.map(async (req) => {
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
    // FIX: 과거 시간(교시) 신청 제한 로직 추가
    const now = new Date();
    const isToday = targetDate.toDateString() === now.toDateString();

    if (isToday && (leaveType === '이석' || leaveType === '컴이석') && periods.length > 0) {
      // timetable_entries에서 오늘 요일 유형에 맞는 시간 정보 가져오기
      const day = targetDate.getDay(); // 0:일, 6:토
      const isWeekend = day === 0 || day === 6;

      const { data: timetable } = await supabase
        .from('timetable_entries')
        .select('*');

      if (timetable) {
        for (const p of periods) {
          // p는 "주간1교시", "야간1교시", "오전1교시" 등의 형식
          let matchType = '';
          const periodNum = p.match(/\d+/) ? p.match(/\d+/)![0] : '';

          if (p.startsWith('주간')) matchType = 'weekday day';
          else if (p.startsWith('야간')) matchType = isWeekend ? 'weekend night' : 'weekday night';
          else if (p.startsWith('오전')) matchType = 'weekend morning';
          else if (p.startsWith('오후')) matchType = 'weekend afternoon';

          // DB의 day_type 또는 description에서 매칭되는 항목 찾기 (유연하게)
          const entry = timetable.find(t => {
            const dt = t.day_type.toLowerCase();
            const desc = t.description?.toLowerCase() || '';
            const normalizedMatchType = matchType.toLowerCase();

            // 타입 매칭 (예: "weekday day"가 "weekday day 1"에 포함되는지)
            const typeMatched = dt.includes(normalizedMatchType);
            // 교시 번호 매칭 (예: "1"이 "weekday day 1" 또는 "1교시"에 포함되는지)
            const numMatched = dt.includes(periodNum) || desc.includes(periodNum);

            return typeMatched && numMatched;
          });

          if (entry && entry.end_time) {
            const [hours, minutes] = entry.end_time.split(':').map(Number);
            const periodEndTime = new Date(now);
            periodEndTime.setHours(hours, minutes, 59, 999);

            if (now > periodEndTime) {
              toast.error(`이미 지난 시간(${p})은 신청할 수 없습니다.`);
              return;
            }
          }
        }
      }
    }

    // FIX: 필수 항목 검증 보완 (일반 이석의 경우 교사, 장소, 사유 필수)
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

    // FIX: 외출은 당일 신청만 가능 (시작일과 종료일이 같아야 함)
    if (leaveType === '외출' && startDate && endDate) {
      if (startDate.toDateString() !== endDate.toDateString()) {
        toast.error('외출은 당일 신청만 가능합니다.');
        return;
      }
    }

    // FIX: 중복 교시/시간 체크 보완 (추가 신청자 포함 전체 검사, 신청/승인 상태 포함)
    // 1. 기간 설정 (당일 0시 ~ 24시 스캔이 아니라, 신청하려는 시간대 기준 전후로 넓게 검사 필요하지만
    //    DB 쿼리 효율을 위해 신청일(targetDate/startDate) 기준 해당 날짜의 전체 기록을 가져와 JS에서 필터링하는 전략 사용)
    const checkDate = (leaveType === '외출' || leaveType === '외박') ? startDate : targetDate;
    if (!checkDate) return;

    const startOfDay = new Date(checkDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = (leaveType === '외박' && endDate) ? new Date(endDate) : new Date(checkDate);
    endOfDay.setHours(23, 59, 59, 999);

    // 내(신청자들) 관련 유효한 이석 기록 가져오기 (메인 신청자 또는 추가 신청자로 포함된 모든 경우)
    const studentIds = addedStudents.map(s => s.student_id);

    // 1-1. 내가 메인 신청자인 경우
    const { data: mainExist } = await supabase
      .from('leave_requests')
      .select('id, leave_type, start_time, end_time, period, student_id, status')
      .in('student_id', studentIds)
      .in('status', ['신청', '승인'])
      .lte('start_time', endOfDay.toISOString())
      .gte('end_time', startOfDay.toISOString());

    // 1-2. 내가 추가 신청자로 등록된 경우
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

    // 목록 합치기 및 중복 제거
    const combinedExist = [...(mainExist || []), ...coExist];
    const existingLeaves = combinedExist.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);

    if (existingLeaves && existingLeaves.length > 0) {
      // 신규 신청 시간 범위 계산
      let newStart: Date, newEnd: Date;

      if (leaveType === '외출' || leaveType === '외박') {
        if (!startDate || !endDate) return;
        newStart = new Date(startDate);
        newEnd = new Date(endDate);
      } else {
        // 주간/야간 이석 등 (교시 기반)
        // 교시를 대략적 시간으로 환산하거나, '같은 교시 문자열'이 있는지 체크
        // 여기서는 단순 교시 문자열 매칭 + 시간 겹침 둘 다 확인
        newStart = new Date(targetDate); // 임시 (교시 로직은 별도)
        newEnd = new Date(targetDate);
      }

      // 충돌 검사
      for (const exist of existingLeaves) {
        const existStatus = exist.status;
        const existDate = new Date(exist.start_time).toLocaleDateString([], { month: 'numeric', day: 'numeric' });

        // 1. 교시 기반 중복 체크 (이석 <-> 이석)
        // 둘 다 교시 정보가 있는 경우 (이석, 컴이석)
        if (exist.period) {
          const existPeriods = exist.period.split(',');
          const duplicatePeriod = periods.find(p => existPeriods.includes(p));
          if (duplicatePeriod) {
            toast.error(`[중복] ${exist.student_id} 학생: 이미 ${duplicatePeriod}에 '${exist.leave_type}(${existStatus})' 신청이 있습니다. (ID: ${exist.id}, 날짜: ${existDate})`);
            return;
          }
        }

        // 2. 시간 기반 중복 체크
        // 기존 이석이 '시간 기반(외출/외박)'이거나, 신규 이석이 '시간 기반'인 경우
        // (단, '이석-이석' 간에는 교시로만 체크하므로 제외... 가 아니라 교시->시간 변환이 어려우니 일단 패스하고)
        // "외출 vs 외출", "외출 vs 이석" 등을 체크해야 함.
        // 하지만 '이석(교시)' 신청 시에는 정확한 시간(Time)을 모르므로(교시 정보만 있음), '외출' 시간과 비교하기가 모호함.
        // 여기서는 '사용자 요청 이슈(컴이석 8,9 vs 야자 1,2)'에 집중하여,
        // 혹시 컴이석이 '시간 범위'로 잡혀서 충돌나는지 확인하려 했으나, '컴이석'은 'period'를 가짐.
        // 따라서 위 1번 블록에서 걸렸을 것임.

        // 만약 신규 신청이 '외출/외박'이라면 시간 비교 수행
        if (leaveType === '외출' || leaveType === '외박') {
          const existStart = new Date(exist.start_time);
          const existEnd = new Date(exist.end_time);

          if (existStart < newEnd && existEnd > newStart) { // Overlap logic
            const formatTime = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
            toast.error(`[시간 중복] ${exist.student_id} 학생: 기존 '${exist.leave_type}' (${formatTime(existStart)}~${formatTime(existEnd)})과 겹칩니다.`);
            return;
          }
        }
      }
    }

    // FIX: 이석/컴이석의 end_time을 당일 23:59:59로 설정하여 '진행 중' 목록에 유지되도록 함
    // 자리비움 로직: 현재 시간 + 10분, 승인 상태
    let finalStartTime = startDate?.toISOString();
    let finalEndTime = endDate?.toISOString();
    let finalStatus = '신청';
    let finalPeriod = (leaveType === '외출' || leaveType === '외박' || leaveType === '자리비움') ? null : periods.join(',');

    if (leaveType === '컴이석' || leaveType === '이석') {
      const periodEndTime = new Date(targetDate);
      periodEndTime.setHours(23, 59, 59, 999);
      finalStartTime = targetDate.toISOString();
      finalEndTime = periodEndTime.toISOString();
      if (leaveType === '컴이석') finalStatus = '승인'; // 컴이석 자동승인
    } else if (leaveType === '자리비움') {
      const now = new Date();
      const tenMinsLater = new Date(now.getTime() + 10 * 60000); // 10 minutes later
      finalStartTime = now.toISOString();
      finalEndTime = tenMinsLater.toISOString();
      finalStatus = '승인'; // 자리비움 자동승인
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

    toast.success(leaveType === '자리비움' ? '10분간 자리비움이 승인되었습니다.' : '이석 신청이 완료되었습니다.');
  };


  return (
    <div className="p-4 md:p-6 bg-gray-100 min-h-screen">
      <Toaster />

      <div className="flex flex-col w-full max-w-xl mx-auto relative">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1.5 h-6 bg-yellow-400 rounded-full"></div>
          <h1 className="text-xl font-extrabold text-gray-800">이석 신청</h1>
        </div>

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
          // 자리비움일 땐 시간 선택 숨김
          (leaveType === '컴이석' || leaveType === '이석') ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}>
          <div className="min-h-0">
            {(() => {
              const day = targetDate.getDay(); // 0:일, 6:토
              const isWeekend = day === 0 || day === 6;

              const typeConfigs = isWeekend
                ? [
                  { key: '오전', label: '오전', periods: ['1', '2', '3'] },
                  { key: '오후', label: '오후', periods: ['4', '5', '6'] },
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
          // 자리비움일 땐 입력 숨김
          (leaveType !== '컴이석' && leaveType !== '자리비움') ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}>
          <div className="min-h-0">
            <div className="flex flex-col gap-3 pb-3">
              {/* FIX: value 속성 추가하여 상태와 UI 동기화 (이석 종류 변경 시 초기화 대응) */}
              <select
                value={teacherId}
                onChange={e => setTeacherId(e.target.value)}
                className="h-12 px-4 rounded-2xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent shadow-sm appearance-none cursor-pointer transition-all w-full"
              >
                <option value="">지도교사</option>
                {teachers.map(t => (
                  t.id && <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>

              <select
                value={place}
                onChange={e => setPlace(e.target.value)}
                className="h-12 px-4 rounded-2xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent shadow-sm appearance-none cursor-pointer transition-all w-full"
              >
                <option value="">이석 장소</option>
                {leavePlaces.map(p => (
                  <option key={p}>{p}</option>
                ))}
              </select>

              <input
                type="text"
                value={reason}
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

          {/* FIX: 맨 아래 카드가 없더라도 두줄정도의 여유공간이 있도록 하단 패딩(pb-24) 추가 */}
          <div className="flex flex-col gap-3 pb-24">
            {/* 탭 전환 UI */}
            <div className="flex bg-[#1a1a1a] rounded-xl p-1 gap-1 w-fit mb-2">
              <button
                onClick={() => setViewMode('active')}
                className={clsx(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  viewMode === 'active' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                )}
              >
                진행 중
              </button>
              <button
                onClick={() => setViewMode('past')}
                className={clsx(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  viewMode === 'past' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                )}
              >
                지난 내역
              </button>
            </div>

            {/* 이석 종류 필터 (전체/컴이석/이석/외출/외박/자리비움) */}
            <div className="flex gap-2 pb-2 overflow-x-auto no-scrollbar">
              {['전체', ...leaveTypes].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={clsx(
                    "px-3 py-1 rounded-full text-[11px] font-bold transition-all whitespace-nowrap border",
                    filterType === type
                      ? "bg-amber-400 text-black border-amber-400"
                      : "bg-transparent text-gray-500 border-white/10 hover:border-white/20"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>

            {(() => {
              const now = new Date();
              const activeRequests = leaveRequests.filter(req => new Date(req.end_time) >= now);
              const pastRequests = leaveRequests.filter(req => new Date(req.end_time) < now);
              const displayList = (viewMode === 'active' ? activeRequests : pastRequests)
                .filter(req => filterType === '전체' || req.leave_type === filterType);

              if (displayList.length === 0) {
                return (
                  <div className="bg-[#1a1a1a] p-10 rounded-[2rem] border border-dashed border-white/10 text-center text-gray-600 text-xs italic">
                    {filterType === '전체'
                      ? (viewMode === 'active' ? '진행 중인 이석 내역이 없습니다.' : '지난 이석 내역이 없습니다.')
                      : `${viewMode === 'active' ? '진행 중인' : '지난'} '${filterType}' 내역이 없습니다.`
                    }
                  </div>
                );
              }

              return displayList.map((req) => {
                const statusConfig = {
                  '신청': { dot: 'bg-blue-500', text: 'text-blue-500', label: '대기' },
                  '승인': { dot: 'bg-green-500', text: 'text-green-500', label: '승인' },
                  '반려': { dot: 'bg-red-500', text: 'text-red-500', label: '반려' },
                  '취소': { dot: 'bg-gray-500', text: 'text-gray-500', label: '취소' },
                }[req.status] || { dot: 'bg-gray-500', text: 'text-gray-500', label: req.status };

                const additionalIds = req.leave_request_students?.map(lrs => lrs.student_id).filter(Boolean) || [];
                const allStudents = [req.student_id, ...additionalIds].filter(Boolean);
                const isExpanded = expandedId === req.id;
                const isPast = viewMode === 'past';

                return (
                  <div
                    key={req.id}
                    onClick={() => setExpandedId(isExpanded ? null : req.id)}
                    className={clsx(
                      "bg-[#1a1a1a] border border-white/5 shadow-2xl transition-all cursor-pointer hover:bg-[#222] overflow-visible relative flex flex-col justify-center",
                      isExpanded ? "rounded-[2rem] p-5" : "rounded-[2rem] px-5 py-3 min-h-[60px]",
                      isPast && "opacity-60"
                    )}
                  >
                    {/* 상단 한 줄 요약 (Collapsed & Expanded Header) */}
                    <div className="flex items-center w-full gap-3">

                      {/* 1. 상태 아이콘 & 이석 종류 */}
                      <div className="flex items-center gap-2 shrink-0 w-[85px]">
                        <div className={clsx(
                          "w-2 h-2 rounded-full",
                          statusConfig.dot,
                          req.status === '신청' && "animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                        )}></div>
                        <span className="text-white font-bold text-xs">{req.leave_type}</span>
                        {req.leave_type !== '컴이석' && (
                          <span className={clsx("text-[10px] px-1.5 py-0.5 rounded border border-opacity-30", statusConfig.text, "border-current")}>
                            {statusConfig.label}
                          </span>
                        )}
                      </div>

                      {/* 신청자, 시간, 사유를 그룹화하여 간격 좁힘 (gap-2) */}
                      <div className="flex flex-1 items-center gap-2 min-w-0">
                        {/* 2. 신청자 (세로 나열) */}
                        <div className="flex flex-col gap-1 shrink-0 justify-center min-w-[3rem]">
                          {allStudents.map((id, idx) => (
                            <span key={idx} className="text-gray-200 text-xs leading-tight whitespace-nowrap">
                              {id}
                            </span>
                          ))}
                        </div>

                        {/* 3. 시간 (Time - 교시 램프 스타일 & 날짜 조건부 표시) */}
                        <div className="flex flex-col gap-1 shrink-0 text-white text-xs justify-center w-32">
                          {(() => {
                            const start = new Date(req.start_time);
                            const now = new Date();
                            const isToday = start.toDateString() === now.toDateString();
                            const day = start.getDay();
                            const isWeekend = day === 0 || day === 6;

                            if (req.period) {
                              // 교시 그룹 정의
                              const groups = isWeekend
                                ? [
                                  { label: '오전', periods: ['1', '2', '3'] },
                                  { label: '오후', periods: ['4', '5', '6'] },
                                  { label: '야간', periods: ['1', '2', '3'] }
                                ]
                                : [
                                  { label: '주간', periods: ['8', '9'] },
                                  { label: '야간', periods: ['1', '2', '3', '4'] }
                                ];

                              const activePeriods = req.period.split(',').map(p => p.trim());

                              return (
                                <div className="flex flex-col gap-1.5">
                                  <div className="flex flex-col gap-1">
                                    {groups.map((group, gIdx) => (
                                      <div key={gIdx} className="flex gap-1 items-center">
                                        <span className="text-[11px] text-gray-400 font-medium w-7 text-left">
                                          {gIdx === 0 ? start.toLocaleDateString([], { month: 'numeric', day: 'numeric' }) : ""}
                                        </span>
                                        <div className="flex gap-1 items-center">
                                          {group.periods.map(p => {
                                            const periodLabel = `${group.label}${p}교시`;
                                            const isActive = activePeriods.includes(periodLabel);
                                            return (
                                              <div
                                                key={p}
                                                className={clsx(
                                                  "w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black transition-all",
                                                  isActive
                                                    ? "bg-yellow-400 text-black shadow-[0_0_8px_rgba(250,204,21,0.6)]"
                                                    : "bg-white/5 text-white/20 border border-white/5"
                                                )}
                                              >
                                                {p}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            } else {
                              // 외출/외박 시간 표시
                              const end = new Date(req.end_time);
                              const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                              const formatDate = (d: Date) => d.toLocaleDateString([], { month: 'numeric', day: 'numeric' });

                              return (
                                <div className="flex flex-col gap-0.5 leading-tight">
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-gray-400 text-[11px] w-7 text-left">{formatDate(start)}</span>
                                      <span className="text-yellow-400 text-[11px] font-bold">{formatTime(start)}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-gray-400 text-[11px] w-7 text-left">{formatDate(end)}</span>
                                      <span className="text-orange-400 text-[11px] font-bold">{formatTime(end)}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                          })()}
                        </div>

                        {/* 4. 사유 (Reason) - 16자 이상 줄바꿈, 주말 이석사유 위치로 통일 */}
                        {!isExpanded && req.reason && (
                          <div className="flex items-center min-w-0 ml-1 max-w-[120px]">
                            <span className="text-gray-400 text-[11px] break-words leading-tight">
                              {req.reason}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 5. 취소 버튼 (우측 끝) */}
                      {!isPast && (
                        <div className="ml-auto flex items-center shrink-0">
                          {req.status !== '취소' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCancelRequest(req.id); }}
                              className="text-gray-500 hover:text-red-500 transition-colors p-1"
                              title="취소"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                    </div>


                    {
                      isExpanded && (
                        <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
                          <div className="grid grid-cols-3 gap-4 text-xs">
                            {req.leave_type !== '컴이석' ? (
                              <>
                                <div className="flex flex-col gap-1">
                                  <span className="text-gray-500 font-bold">지도교사</span>
                                  <span className="text-white">{(req as any).teachers?.name || '-'}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-gray-500 font-bold">장소</span>
                                  <span className="text-white">{req.place || '-'}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-gray-500 font-bold">사유</span>
                                  <span className="text-white">{req.reason || '-'}</span>
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col gap-1 col-span-3">
                                <span className="text-gray-500 font-bold italic text-[10px]">컴이석은 별도 장소/사유가 필요하지 않습니다.</span>
                              </div>
                            )}
                          </div>

                          {/* 전체 신청자 목록 */}
                          {additionalIds.length > 0 && (
                            <div className="flex flex-col gap-1">
                              <span className="text-gray-500 font-bold">함께하는 학생들</span>
                              <div className="flex flex-wrap gap-1.5">
                                {allStudents.map(id => (
                                  <span key={id} className="bg-gray-800 px-2 py-1 rounded text-gray-300">
                                    {id}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex flex-col gap-1">
                            <span className="text-gray-500 font-bold">신청 일시</span>
                            <span className="text-gray-400 text-xs">
                              {new Date(req.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )
                    }
                  </div>
                );
              })
            })()}
          </div>
        </div>
      </div>
    </div >
  );
}
