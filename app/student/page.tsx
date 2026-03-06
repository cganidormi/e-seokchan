'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/supabaseClient';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { Student, Teacher, LeaveRequest } from '@/components/student/types';
import { LeaveRequestForm } from '@/components/student/LeaveRequestForm';
import { LeaveStatusList } from '@/components/student/LeaveStatusList';
import WeeklyReturnApplicationCard from '@/components/student/WeeklyReturnApplicationCard';
import { NotificationPermissionBanner } from '@/components/NotificationPermissionBanner';
import PullToRefresh from '@/components/PullToRefresh';
import { MdLockReset } from 'react-icons/md';

export default function StudentPage() {
  const [studentId, setStudentId] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [initialFormData, setInitialFormData] = useState<any>(null); // State for Copy functionality
  const [unreadSummonCount, setUnreadSummonCount] = useState(0); // App Badge state

  // Student Notice Board State
  const [noticeText, setNoticeText] = useState('각 호실에 호실점검 체크리스트가 있습니다. \n호실의 시설물을 꼭 직접 확인 하시고 체크리스트를 채운 후 사감선생님께 제출하세요.');
  const [isEditingNotice, setIsEditingNotice] = useState(false);
  const [editNoticeContent, setEditNoticeContent] = useState('');
  const [isSavingNotice, setIsSavingNotice] = useState(false);
  const [targetStudentId, setTargetStudentId] = useState('all');

  const router = useRouter(); // Initialized useRouter

  useEffect(() => {
    // 1. Session & Role Check
    const loginId = localStorage.getItem('dormichan_login_id') || sessionStorage.getItem('dormichan_login_id');
    const role = localStorage.getItem('dormichan_role') || sessionStorage.getItem('dormichan_role');

    if (!loginId || role !== 'student') {
      router.push('/login');
      return;
    }

    setStudentId(loginId);

    // Initial data fetch
    const fetchData = async () => {
      const { data: studentsData } = await supabase.from('students').select('*');
      if (studentsData) {
        setStudents(studentsData as Student[]);
      }

      const { data: teachersData } = await supabase.from('teachers').select('id, name');
      if (teachersData) setTeachers(teachersData as Teacher[]);

      if (loginId) fetchLeaveRequests(loginId);
      setIsLoading(false);
    };

    fetchData();

    // Subscribe to changes
    if (loginId) {
      const channel = supabase
        .channel('leave_requests_student')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
          fetchLeaveRequests(loginId);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_request_students' }, () => {
          fetchLeaveRequests(loginId);
        })
        .subscribe();

      // Subscribe to students table for personal notice updates
      const studentsChannel = supabase
        .channel('public:students_notice')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, (payload: any) => {
          if (payload.new && payload.new.student_id) {
            setStudents(prev => prev.map(s =>
              s.student_id === payload.new.student_id
                ? { ...s, personal_notice: payload.new.personal_notice }
                : s
            ));
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(studentsChannel);
      };
    }
  }, []);

  // 1-1. Online/Offline Revalidation
  useEffect(() => {
    const handleOnline = () => {
      if (studentId) fetchLeaveRequests(studentId);
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [studentId]);

  // 1-2. Fetch and Subscribe to Student Notice Board
  useEffect(() => {
    const fetchNotice = async () => {
      const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'student_notice').single();
      if (data && data.setting_value) {
        setNoticeText(data.setting_value);
      }
    };
    fetchNotice();

    const noticeChannel = supabase
      .channel('public:system_settings:student')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_settings', filter: 'setting_key=eq.student_notice' },
        (payload: any) => {
          if (payload.new && payload.new.setting_value) {
            setNoticeText(payload.new.setting_value);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(noticeChannel);
    };
  }, []);

  const searchParams = useSearchParams();

  // Load and display unread summons on mount and when URL params change
  useEffect(() => {
    // 1. Check for NEW summon from URL
    const isSummon = searchParams.get('summon');
    const teacherName = searchParams.get('teacherName');
    const message = searchParams.get('message');

    let currentSummons = JSON.parse(localStorage.getItem('dormichan_unread_summons') || '[]');

    if (isSummon === 'true' && teacherName) {
      const newSummon = {
        id: Date.now(), // Unique ID based on timestamp
        teacherName: decodeURIComponent(teacherName),
        message: message ? decodeURIComponent(message) : "이석을 신청하거나 학습실로 돌아오세요.",
        timestamp: new Date().toISOString()
      };

      // Add to local storage (avoid exact duplicates within 5 seconds if multiple effects fire)
      const isDuplicate = currentSummons.some((s: any) =>
        s.teacherName === newSummon.teacherName &&
        Math.abs(new Date(s.timestamp).getTime() - newSummon.id) < 5000
      );

      if (!isDuplicate) {
        currentSummons.push(newSummon);
        localStorage.setItem('dormichan_unread_summons', JSON.stringify(currentSummons));
        setUnreadSummonCount(currentSummons.length);

        // Clean URL immediately to prevent re-adding on soft refresh
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }

    // 2. Clear existing toasts to prevent duplicates when re-rendering
    // (Optional: react-hot-toast manages this, but we want to ensure we show ALL from storage)
    toast.dismiss();

    // 3. Display ALL unread summons from LocalStorage
    currentSummons.forEach((summon: any) => {
      toast((t) => (
        <div className="flex flex-col gap-2 min-w-[300px]">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📢</span>
            <span className="font-bold text-lg text-red-600">선생님 호출</span>
            <span className="text-xs text-gray-400 font-normal ml-auto">
              {new Date(summon.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="font-bold text-gray-800 text-base">
            {summon.teacherName} 선생님
          </div>
          <div className="text-gray-600 break-keep">
            "{summon.message}"
          </div>
          <button
            onClick={() => {
              toast.dismiss(t.id);
              // Remove from LocalStorage
              const remaining = JSON.parse(localStorage.getItem('dormichan_unread_summons') || '[]')
                .filter((s: any) => s.id !== summon.id);
              localStorage.setItem('dormichan_unread_summons', JSON.stringify(remaining));
              setUnreadSummonCount(remaining.length);
            }}
            className="mt-2 bg-red-100 text-red-600 py-1 px-3 rounded font-bold text-sm hover:bg-red-200"
          >
            확인
          </button>
        </div>
      ), {
        duration: Infinity,
        position: 'top-center',
        id: `summon-${summon.id}`, // specific ID to prevent duplicates
        style: {
          border: '2px solid #ef4444',
          padding: '16px',
        },
      });
    });
    setUnreadSummonCount(currentSummons.length);
  }, [searchParams]);

  // Update App Icon Badge (Real-time summon count for Students)
  useEffect(() => {
    if ('setAppBadge' in navigator && 'clearAppBadge' in navigator) {
      if (unreadSummonCount > 0) {
        (navigator as any).setAppBadge(unreadSummonCount).catch((e: any) => console.error('Student Badge error:', e));
      } else {
        (navigator as any).clearAppBadge().catch((e: any) => console.error('Student Badge clear error:', e));
      }
    }
  }, [unreadSummonCount]);

  const fetchLeaveRequests = async (id: string) => {
    try {
      // 0. Fetch Teachers Map manually (since FK join failed)
      const { data: teachersData } = await supabase.from('teachers').select('id, name');
      const teacherMap = new Map();
      teachersData?.forEach((t: { id: string; name: string }) => {
        teacherMap.set(t.id, t.name);
      });

      // 1. Fetch "Public" requests
      const { data: publicRequests, error: publicError } = await supabase
        .from('leave_requests')
        .select('*, leave_request_students(student_id)')
        .neq('leave_type', '외출')
        .neq('leave_type', '외박')
        .order('created_at', { ascending: false })
        .limit(200);

      if (publicError) {
        throw publicError;
      }

      // 2. Fetch "Private" requests
      // 2a. Main
      const { data: myMainPrivateRequests, error: myMainError } = await supabase
        .from('leave_requests')
        .select('*, leave_request_students(student_id)')
        .eq('student_id', id)
        .in('leave_type', ['외출', '외박'])
        .order('created_at', { ascending: false })
        .limit(200);

      if (myMainError) {
        console.error('[DEBUG] My Main Private Fetch Error:', JSON.stringify(myMainError));
        throw myMainError;
      }

      // 2b. Co-applicant
      const { data: coLinkData } = await supabase
        .from('leave_request_students')
        .select('leave_request_id')
        .eq('student_id', id)
        .order('created_at', { ascending: false })
        .limit(200);

      const coRequestIds = coLinkData?.map(c => c.leave_request_id) || [];

      let myCoPrivateRequests: any[] = [];
      if (coRequestIds.length > 0) {
        const { data: fetchedCo, error: coError } = await supabase
          .from('leave_requests')
          .select('*, leave_request_students(student_id)')
          .in('id', coRequestIds)
          .in('leave_type', ['외출', '외박'])
          .order('created_at', { ascending: false });

        if (coError) {
          throw coError;
        }

        if (fetchedCo) myCoPrivateRequests = fetchedCo;
      }

      // 3. Combine
      const allRequests = [
        ...(publicRequests || []),
        ...(myMainPrivateRequests || []),
        ...myCoPrivateRequests
      ];

      // Deduplicate
      const uniqueRequestsMap = new Map();
      allRequests.forEach(req => uniqueRequestsMap.set(req.id, req));
      const combinedRequests = Array.from(uniqueRequestsMap.values());

      combinedRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Transform: manual join for teachers
      const transformed = combinedRequests.map(req => ({
        ...req,
        teachers: req.teacher_id ? { name: teacherMap.get(req.teacher_id) || req.teacher_id } : { name: '-' },
      }));

      setLeaveRequests(transformed as any[]);
    } catch (err: any) {
    }
  };

  const handleCancelRequest = async (requestId: number) => {
    const targetReq = leaveRequests.find(r => r.id === requestId);
    if (!targetReq) return;

    let message = '신청을 취소하시겠습니까?';
    if (targetReq.leave_type === '외출' || targetReq.leave_type === '외박') {
      const isApproved = targetReq.status === '승인' || targetReq.status === '학부모승인';
      if (isApproved) {
        message = '신청을 취소하시겠습니까? 승인된 건은 보호자와 선생님께 알림이 전송될 수 있습니다.';
      }
    }

    if (!confirm(message)) return;

    try {
      const res = await fetch('/api/student/cancel-leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, studentId })
      });

      const responseText = await res.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Response parsing failed:', responseText);
        throw new Error('서버 응답 오류 (JSON 파싱 실패)');
      }

      if (!res.ok) {
        throw new Error(data.error || '취소 실패');
      }

      toast.success(data.message || '처리되었습니다.');
      if (studentId) fetchLeaveRequests(studentId);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message);
    }
  };

  const handleSaveNotice = async () => {
    if (!editNoticeContent.trim()) {
      toast.error('안내 내용을 입력해주세요.');
      return;
    }
    setIsSavingNotice(true);
    try {
      const res = await fetch('/api/student/update-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          target_student_id: targetStudentId,
          new_notice_text: editNoticeContent
        })
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || '저장 실패');

      toast.success(targetStudentId === 'all' ? '전체 전광판이 업데이트되었습니다.' : '개별 학생에게 알림을 보냈습니다.');
      setIsEditingNotice(false);

      if (targetStudentId === 'all') {
        setNoticeText(editNoticeContent);
        setStudents(prev => prev.map(s => ({ ...s, personal_notice: undefined } as any)));
      } else {
        setStudents(prev => prev.map(s =>
          s.student_id === targetStudentId
            ? { ...s, personal_notice: editNoticeContent } as any
            : s
        ));
      }
      setTargetStudentId('all');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSavingNotice(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('dormichan_login_id');
    localStorage.removeItem('dormichan_role');
    localStorage.removeItem('dormichan_keepLoggedIn');
    sessionStorage.removeItem('dormichan_login_id');
    sessionStorage.removeItem('dormichan_role');
    sessionStorage.removeItem('dormichan_keepLoggedIn');
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const currentStudent = students.find(s => s.student_id === studentId) || null;
  const isNoticeAdmin = currentStudent?.grade === 3 && currentStudent?.class === 3 && currentStudent?.number === 17 && currentStudent?.name === '홍길동';

  const isPersonalNotice = !!(currentStudent as any)?.personal_notice;
  const displayNoticeText = isPersonalNotice ? (currentStudent as any).personal_notice : noticeText;

  // Compute Room and Bed Position
  let bedInfoText = '배정중';
  if (currentStudent && currentStudent.room_number) {
    const roomNum = currentStudent.room_number;

    // Find all students in this room and sort them to match headcount page logic
    const roommates = students.filter(s => s.room_number === roomNum).sort((a, b) => a.name.localeCompare(b.name));

    // Find index of current student (0 = Left, 1 = Right, normally)
    const myIndex = roommates.findIndex(s => s.student_id === studentId);

    if (myIndex !== -1) {
      // Determine if this room is visually flipped.
      // 120-123, 222-227, 420-425 are flipped.
      const FLIPPED_ROOMS = [120, 121, 122, 123, 222, 223, 224, 225, 226, 227, 420, 421, 422, 423, 424, 425];
      const isFlipped = FLIPPED_ROOMS.includes(roomNum);

      const floor = Math.floor(roomNum / 100);

      let positionText = '';
      if (myIndex === 0) {
        positionText = isFlipped ? '우(R)' : '좌(L)';
      } else if (myIndex === 1) {
        positionText = isFlipped ? '좌(L)' : '우(R)';
      } else {
        positionText = '?'; // Fallback if more than 2
      }

      bedInfoText = `호실 : ${floor}층 ${roomNum}호 ${positionText}`;
    }
  }

  const handleCopyRequest = (req: LeaveRequest) => {
    setInitialFormData(req);
    // Scroll to top to see form
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.success('신청 내용이 복사되었습니다. 내용을 확인 후 신청 버튼을 눌러주세요.');
  };

  return (
    <div className="p-4 md:p-6 bg-gray-100 min-h-screen">
      <Toaster />

      {/* Persistent Notification Warning */}
      {studentId && (
        <NotificationPermissionBanner userId={studentId} userType="student" />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center mb-6 gap-3 md:gap-5 w-full">
        <div className="flex items-center justify-between w-full md:w-auto shrink-0 gap-3">
          <h1 className="text-xl font-bold text-gray-800">
            <span>{currentStudent?.name || studentId} 학생</span>
          </h1>
          <button
            onClick={() => router.push(`/change-password?role=student&id=${studentId}`)}
            className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 font-bold py-1 px-3 rounded-xl shadow-sm transition-all flex items-center justify-center text-sm"
            title="비밀번호 변경"
          >
            <MdLockReset className="w-5 h-5 text-gray-700" />
            <span className="ml-1 text-sm font-semibold text-gray-700">비밀번호 변경</span>
          </button>
        </div>
        <div className="bg-white border-2 border-amber-300 rounded-xl p-3 shadow-sm w-full md:w-auto md:max-w-2xl relative">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold text-white px-2 py-0.5 rounded shadow-sm ${isPersonalNotice ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`}>
                {isPersonalNotice ? '💌 개인 편지' : '홍지관 안내문'}
              </span>
              <span className="text-sm md:text-base font-extrabold text-amber-900">{bedInfoText}</span>
            </div>
            {isNoticeAdmin && !isEditingNotice && (
              <button
                onClick={() => {
                  setTargetStudentId('all');
                  setEditNoticeContent(noticeText);
                  setIsEditingNotice(true);
                }}
                className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded font-bold hover:bg-amber-200 transition whitespace-nowrap ml-2"
              >
                ✏️ 수정
              </button>
            )}
          </div>

          {isEditingNotice ? (
            <div className="space-y-2 mt-2">
              <select
                value={targetStudentId}
                onChange={(e) => {
                  setTargetStudentId(e.target.value);
                  if (e.target.value !== 'all') {
                    setEditNoticeContent('');
                  } else {
                    setEditNoticeContent(noticeText);
                  }
                }}
                className="w-full text-sm p-2 border border-amber-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white text-gray-900 font-semibold"
              >
                <option value="all">📢 전체 학생</option>
                <optgroup label="개별 학생 선택">
                  {students.sort((a, b) => `${a.grade}${a.class}${a.number}`.localeCompare(`${b.grade}${b.class}${b.number}`)).map(s => (
                    <option key={s.student_id} value={s.student_id}>
                      {s.grade}-{s.class} {s.name}
                    </option>
                  ))}
                </optgroup>
              </select>
              <textarea
                value={editNoticeContent}
                onChange={(e) => setEditNoticeContent(e.target.value)}
                className="w-full text-sm p-2 border border-amber-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-400 min-h-[60px] resize-none text-gray-900 font-medium"
                placeholder="공지내용 입력..."
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsEditingNotice(false)} className="px-3 py-1 bg-gray-200 text-gray-700 text-xs font-bold rounded hover:bg-gray-300">취소</button>
                <button onClick={handleSaveNotice} disabled={isSavingNotice} className="px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded hover:bg-amber-600 disabled:opacity-50">
                  {isSavingNotice ? '저장 중...' : '저장하기'}
                </button>
              </div>
            </div>
          ) : (
            <p className={`text-xs md:text-sm break-keep leading-relaxed font-medium whitespace-pre-wrap ${isPersonalNotice ? 'text-red-700 font-bold' : 'text-gray-700'}`}>
              {displayNoticeText}
            </p>
          )}
        </div>
      </div>

      <PullToRefresh onRefresh={() => studentId ? fetchLeaveRequests(studentId) : Promise.resolve()}>
        <div className="flex flex-col gap-4">
          <WeeklyReturnApplicationCard student={currentStudent} />
          <LeaveRequestForm
            studentId={studentId}
            students={students}
            teachers={teachers}
            onSubmitSuccess={() => fetchLeaveRequests(studentId)}
            initialData={initialFormData}
          />
          <LeaveStatusList
            leaveRequests={leaveRequests}
            onCancel={handleCancelRequest}
            onCopy={handleCopyRequest}
            leaveTypes={['컴이석', '이석', '외출', '외박', '자리비움']}
            students={students}
            studentId={studentId}
          />
        </div>
      </PullToRefresh>
    </div>
  );
}
