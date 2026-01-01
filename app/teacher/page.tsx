'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import clsx from 'clsx';

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
  created_at: string;
  leave_request_students?: {
    student_id: string;
  }[];
}

export default function TeacherPage() {
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [viewMode, setViewMode] = useState<'active' | 'past'>('active');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [statusMenuId, setStatusMenuId] = useState<number | null>(null);

  useEffect(() => {
    const resolveTeacherInfo = async () => {
      try {
        const loginId = localStorage.getItem('dormichan_login_id') || sessionStorage.getItem('dormichan_login_id');
        const role = localStorage.getItem('dormichan_role') || sessionStorage.getItem('dormichan_role');

        if (loginId && role === 'teacher') {
          // Resolve teacher UUID from loginId
          const { data: teacher, error } = await supabase
            .from('teachers')
            .select('id, name')
            .eq('teacher_id', loginId)
            .single();

          if (teacher) {
            setTeacherId(teacher.id);
            setTeacherName(teacher.name);
            await fetchLeaveRequests(teacher.id, teacher.name);
          } else {
            console.error('Teacher record not found for login ID:', loginId);
          }
        }
      } catch (err) {
        console.error('Session resolution error:', err);
      } finally {
        // 학생 정보도 같이 불러오기
        const { data: studentData } = await supabase.from('students').select('*');
        if (studentData) setStudents(studentData);
        setIsLoading(false);
      }
    };

    resolveTeacherInfo();
  }, []);

  // 🔑 실시간 구독 처리
  useEffect(() => {
    if (!teacherId) return;

    const channel = supabase
      .channel('leave_requests_teacher_global')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leave_requests' },
        () => {
          console.log('Realtime update detected for teacher, refetching...');
          fetchLeaveRequests(teacherId, teacherName);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teacherId, teacherName]);

  const fetchLeaveRequests = async (id: string, name: string) => {
    try {
      console.log('Fetching requests for teacher UUID:', id);

      // The teacher_id column in leave_requests is a UUID type.
      // Querying with a non-UUID string (like a name) will cause a 400 error.
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('teacher_id', id)
        .neq('status', '취소')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase query error:', error.message, error.details);
        throw error;
      }
      console.log(`Fetched ${data?.length || 0} requests for ${name}`);

      // fetch students for each request
      const requestsWithStudents = await Promise.all((data || []).map(async (req) => {
        const { data: students } = await supabase
          .from('leave_request_students')
          .select('student_id')
          .eq('leave_request_id', req.id);
        return { ...req, leave_request_students: students || [] };
      }));

      console.log('Requests with students:', requestsWithStudents);
      setLeaveRequests(requestsWithStudents);
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error('현황을 불러오지 못했습니다.');
    }
  };

  const handleUpdateStatus = async (requestId: number, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (error) throw error;

      toast.success(`상태가 ${newStatus}(으)로 변경되었습니다.`);
      setStatusMenuId(null);

      // 즉시 재조회하여 UI 업데이트
      if (teacherId) {
        await fetchLeaveRequests(teacherId, teacherName);
      }
    } catch (err) {
      console.error('Update error:', err);
      toast.error('상태 변경에 실패했습니다.');
    }
  };

  const handleCancelRequest = async (requestId: number) => {
    if (!confirm('신청을 취소(삭제)하시겠습니까?')) return;

    const { error } = await supabase
      .from('leave_requests')
      .update({ status: '취소' })
      .eq('id', requestId);

    if (error) {
      toast.error('취소 실패');
    } else {
      toast.success('취소되었습니다.');
      if (teacherId) fetchLeaveRequests(teacherId, teacherName);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!teacherId) {
    return (
      <div className="p-10 text-center max-w-xl mx-auto flex flex-col items-center justify-center min-h-screen">
        <Toaster />
        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-6">
          <span className="text-2xl">🔒</span>
        </div>
        <h1 className="text-xl font-bold mb-4 text-gray-800">접근 권한이 없습니다.</h1>
        <p className="text-gray-500 mb-6">교사 계정으로 로그인되어 있는지 확인해 주세요.</p>
        <button
          onClick={() => window.location.href = '/login'}
          className="px-6 py-3 bg-yellow-400 text-white font-bold rounded-2xl hover:bg-yellow-500 transition-all"
        >
          로그인 페이지로 이동
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-gray-100 min-h-screen">
      <Toaster />

      <div className="flex flex-col w-full max-w-xl mx-auto relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-6 bg-yellow-400 rounded-full"></div>
            <h1 className="text-xl font-extrabold text-gray-800">이석 처리 ({teacherName} 교사)</h1>
          </div>
        </div>

        {/* 탭 전환 UI */}
        <div className="flex bg-[#1a1a1a] rounded-xl p-1 gap-1 w-fit mb-4">
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
          <button
            onClick={() => window.location.href = '/teacher/seats'}
            className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-yellow-400 hover:text-yellow-300"
          >
            학습감독 자리배치도
          </button>
        </div>
        <div className="flex flex-col gap-3 pb-24">
          {(() => {
            const now = new Date();
            const filtered = (leaveRequests || []).filter(req => {
              const endTime = new Date(req.end_time);
              const isPast = endTime < now;
              return viewMode === 'active' ? !isPast : isPast;
            });

            console.log(`Current ViewMode: ${viewMode}, Total: ${leaveRequests.length}, Filtered: ${filtered.length}`);

            if (filtered.length === 0) {
              return (
                <div className="bg-[#1a1a1a] p-10 rounded-[2rem] border border-dashed border-white/10 text-center text-gray-600 text-xs italic">
                  {viewMode === 'active' ? '처리할 이석 내역이 없습니다.' : '지난 내역이 없습니다.'}
                  {leaveRequests.length > 0 && (
                    <p className="mt-2 text-gray-700">
                      총 {leaveRequests.length}개의 내역이 존재하나 현재 필터에 해당하지 않습니다.
                    </p>
                  )}
                </div>
              );
            }

            return filtered.map((req) => {
              const statusConfig = {
                '신청': { dot: 'bg-blue-500', text: 'text-blue-500', label: '대기' },
                '승인': { dot: 'bg-green-500', text: 'text-green-500', label: '승인' },
                '반려': { dot: 'bg-red-500', text: 'text-red-500', label: '반려' },
              }[req.status] || { dot: 'bg-gray-500', text: 'text-gray-500', label: req.status };

              const additionalIds = req.leave_request_students?.map(lrs => lrs.student_id) || [];
              const allStudents = [req.student_id, ...additionalIds];
              const isExpanded = expandedId === req.id;
              const isMenuOpen = statusMenuId === req.id;

              return (
                <div
                  key={req.id}
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                  className={clsx(
                    "bg-[#1a1a1a] border border-white/5 shadow-2xl transition-all cursor-pointer hover:bg-[#222] overflow-visible relative flex flex-col justify-center",
                    isExpanded ? "rounded-[2rem] p-5" : "rounded-[2rem] px-5 py-3 min-h-[60px]",
                    viewMode === 'past' && "opacity-60"
                  )}
                >
                  <div className="flex items-center w-full gap-3">
                    {/* 1. 이석 종류 & 상태 아이콘 */}
                    <div className="flex items-center gap-2 shrink-0 w-[85px]">
                      <div className={clsx(
                        "w-2 h-2 rounded-full",
                        statusConfig.dot,
                        req.status === '신청' && "animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                      )}></div>
                      <span className="text-white font-bold text-xs">{req.leave_type}</span>

                      <div className="relative shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setStatusMenuId(isMenuOpen ? null : req.id);
                          }}
                          className={clsx(
                            "flex items-center px-1.5 py-0.5 rounded border border-opacity-30 transition-all duration-200 text-[10px] font-bold border-current",
                            statusConfig.text,
                            req.status === '신청' ? "bg-blue-500/10" : "bg-white/5"
                          )}
                        >
                          {statusConfig.label}
                        </button>

                        {isMenuOpen && (
                          <div className="absolute top-full left-0 mt-2 bg-[#2a2a2a] border border-white/10 rounded-2xl shadow-2xl z-50 py-2 w-24 animate-in fade-in slide-in-from-top-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleUpdateStatus(req.id, '신청'); }}
                              className="w-full px-4 py-2 text-left text-xs text-blue-400 hover:bg-white/5 font-bold"
                            >
                              대기
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleUpdateStatus(req.id, '승인'); }}
                              className="w-full px-4 py-2 text-left text-xs text-green-400 hover:bg-white/5 font-bold"
                            >
                              승인
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleUpdateStatus(req.id, '반려'); }}
                              className="w-full px-4 py-2 text-left text-xs text-red-400 hover:bg-white/5 font-bold"
                            >
                              반려
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-1 items-center gap-2 min-w-0">
                      <div className="flex flex-col gap-1 shrink-0 justify-center min-w-[3rem]">
                        {allStudents.map((id, idx) => (
                          <span key={id} className="text-gray-200 text-xs leading-tight font-medium whitespace-nowrap">
                            {id}
                          </span>
                        ))}
                      </div>
                      {/* 3. 시간 (Time - 학생 페이지와 동일한 램프 스타일) */}
                      <div className="flex flex-col gap-1 shrink-0 text-white text-xs justify-center w-32">
                        {(() => {
                          const start = new Date(req.start_time);
                          const now = new Date();
                          const isToday = start.toDateString() === now.toDateString();
                          const day = start.getDay();
                          const isWeekend = day === 0 || day === 6;

                          if (req.period) {
                            const groups = isWeekend
                              ? [{ label: '오전', periods: ['1', '2', '3'] }, { label: '오후', periods: ['4', '5', '6'] }, { label: '야간', periods: ['1', '2', '3'] }]
                              : [{ label: '주간', periods: ['8', '9'] }, { label: '야간', periods: ['1', '2', '3', '4'] }];

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
                            const end = new Date(req.end_time);
                            const fTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                            const fDate = (d: Date) => d.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
                            return (
                              <div className="flex flex-col gap-0.5 leading-tight">
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-400 text-[11px] w-7 text-left">{fDate(start)}</span>
                                    <span className="text-yellow-400 text-[11px] font-bold">{fTime(start)}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-400 text-[11px] w-7 text-left">{fDate(end)}</span>
                                    <span className="text-orange-400 text-[11px] font-bold">{fTime(end)}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                        })()}
                      </div>

                      {!isExpanded && req.reason && (
                        <div className="flex items-center min-w-0 ml-4 max-w-[120px]">
                          <span className="text-gray-400 text-[11px] break-words leading-tight">
                            {req.reason}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 5. 취소 버튼 (우측 끝) */}
                    <div className="ml-auto flex items-center shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCancelRequest(req.id); }}
                        className="text-gray-500 hover:text-red-500 transition-colors p-1"
                        title="취소"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
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

                      {/* 신청 일시 */}
                      <div className="flex flex-col gap-1">
                        <span className="text-gray-500 font-bold">신청 일시</span>
                        <span className="text-gray-400 text-xs">
                          {new Date(req.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}