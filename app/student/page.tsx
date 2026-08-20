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
import AnniversaryBanner from '@/components/parent/ParentsDayCelebration';
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
  const [sendPushNotification, setSendPushNotification] = useState(false);
  const [isSavingNotice, setIsSavingNotice] = useState(false);
  const [targetStudentId, setTargetStudentId] = useState('all');
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);

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

  // 1-2. Fetch and Subscribe to Student Notice Board (with Room Visibility tag check)
  useEffect(() => {
    const parseNoticeAndVisibility = (rawVal: string) => {
      if (rawVal.includes('__ROOM_PUBLIC:true__')) {
        setShowRoomInfo(true);
        return rawVal.replace(/\n?__ROOM_PUBLIC:true__/, '').trim();
      } else if (rawVal.includes('__ROOM_PUBLIC:false__')) {
        setShowRoomInfo(false);
        return rawVal.replace(/\n?__ROOM_PUBLIC:false__/, '').trim();
      } else {
        setShowRoomInfo(false);
        return rawVal;
      }
    };

    const fetchNotice = async () => {
      const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'student_notice').single();
      if (data && data.setting_value) {
        const cleanText = parseNoticeAndVisibility(data.setting_value);
        setNoticeText(cleanText);
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
            const cleanText = parseNoticeAndVisibility(payload.new.setting_value);
            setNoticeText(cleanText);
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

    let currentSummons = [];
    try {
      currentSummons = JSON.parse(localStorage.getItem('dormichan_unread_summons') || '[]');
      if (!Array.isArray(currentSummons)) currentSummons = [];
    } catch (e) {
      console.error('Failed to parse summons from localStorage:', e);
      currentSummons = [];
    }

    if (isSummon === 'true' && teacherName) {
      const newSummon = {
        id: Date.now(), // Unique ID based on timestamp
        teacherName: decodeURIComponent(teacherName),
        message: message ? decodeURIComponent(message) : "이석을 신청하거나 학습실로 돌아오세요.",
        timestamp: new Date().toISOString()
      };

      // Add to local storage (avoid exact duplicates within 5 seconds if multiple effects fire)
      const isDuplicate = currentSummons.some((s: any) =>
        s && s.teacherName === newSummon.teacherName &&
        s.timestamp && Math.abs(new Date(s.timestamp).getTime() - newSummon.id) < 5000
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
    toast.dismiss();

    // 3. Display ALL unread summons from LocalStorage
    currentSummons.forEach((summon: any) => {
      if (!summon || !summon.timestamp) return;
      const summonDate = new Date(summon.timestamp);
      if (isNaN(summonDate.getTime())) return; // Safe check for invalid date!

      toast((t) => (
        <div className="flex flex-col gap-2 min-w-[300px]">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📢</span>
            <span className="font-bold text-lg text-red-600">선생님 호출</span>
            <span className="text-xs text-gray-400 font-normal ml-auto">
              {summonDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
              try {
                const remaining = JSON.parse(localStorage.getItem('dormichan_unread_summons') || '[]')
                  .filter((s: any) => s && s.id !== summon.id);
                localStorage.setItem('dormichan_unread_summons', JSON.stringify(remaining));
                setUnreadSummonCount(remaining.length);
              } catch (err) {
                console.error(err);
              }
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
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const nowStr = new Date().toISOString();

      // Define optimized filter: Currently active OR created within the last 7 days
      const timeFilter = `end_time.gte.${nowStr},created_at.gte.${sevenDaysAgo}`;

      // 1. Parallel Fetching for maximum efficiency
      const [
        { data: teachersData, error: teachersError },
        { data: publicRequests, error: publicError },
        { data: myMainRequests, error: myMainError },
        { data: coLinkData, error: coLinkError }
      ] = await Promise.all([
        supabase.from('teachers').select('id, name'),
        supabase.from('leave_requests')
          .select('*, leave_request_students(student_id)')
          .neq('leave_type', '외출')
          .neq('leave_type', '외박')
          .or(timeFilter)
          .order('created_at', { ascending: false })
          .limit(300),
        supabase.from('leave_requests')
          .select('*, leave_request_students(student_id)')
          .eq('student_id', id)
          .in('leave_type', ['외출', '외박'])
          .or(timeFilter)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('leave_request_students')
          .select('leave_request_id')
          .eq('student_id', id)
          .order('created_at', { ascending: false })
          .limit(200)
      ]);

      if (teachersError) console.error('[DEBUG] Teachers fetch error:', teachersError);
      if (publicError) throw publicError;
      if (myMainError) throw myMainError;
      if (coLinkError) throw coLinkError;

      // Teacher Map for fast lookups
      const teacherMap = new Map();
      teachersData?.forEach((t: { id: string; name: string }) => {
        teacherMap.set(t.id, t.name);
      });

      // 2. Fetch "Private" requests where I am a co-applicant
      const coRequestIds = coLinkData?.map(c => c.leave_request_id) || [];
      let myCoPrivateRequests: any[] = [];
      if (coRequestIds.length > 0) {
        const { data: fetchedCo, error: coError } = await supabase
          .from('leave_requests')
          .select('*, leave_request_students(student_id)')
          .in('id', coRequestIds)
          .in('leave_type', ['외출', '외박'])
          .or(timeFilter)
          .order('created_at', { ascending: false });

        if (coError) throw coError;
        if (fetchedCo) myCoPrivateRequests = fetchedCo;
      }

      // 3. Combine and Deduplicate (Public Iseoks + My Personal Outings/Stays)
      const allRequests = [
        ...(publicRequests || []),
        ...(myMainRequests || []),
        ...myCoPrivateRequests
      ];

      const uniqueRequestsMap = new Map();
      allRequests.forEach(req => uniqueRequestsMap.set(req.id, req));
      const combinedRequests = Array.from(uniqueRequestsMap.values());

      // Sort by creation date (newest first)
      combinedRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // 4. Transform: add teacher names
      const transformed = combinedRequests.map(req => ({
        ...req,
        teachers: req.teacher_id ? { name: teacherMap.get(req.teacher_id) || req.teacher_id } : { name: '-' },
      }));

      setLeaveRequests(transformed as any[]);
    } catch (err: any) {
      console.error('[Student Fetch Error]:', err);
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
    const payloadNoticeText = targetStudentId === 'all'
      ? `${editNoticeContent}\n__ROOM_PUBLIC:${showRoomInfo}__`
      : editNoticeContent;

    try {
      const res = await fetch('/api/student/update-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          target_student_id: targetStudentId,
          new_notice_text: payloadNoticeText,
          send_push: sendPushNotification
        })
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || '저장 실패');

      if (sendPushNotification) {
        toast.success(targetStudentId === 'all' ? '전체 공지가 업데이트되고 푸시 알림이 발송되었습니다.' : '개별 공지가 업데이트되고 푸시 알림이 발송되었습니다.');
      } else {
        toast.success('공지 내용만 조용히 업데이트되었습니다. (푸시 알림 미발송)');
      }
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

  const handleToggleRoomVisibility = async () => {
    setIsUpdatingVisibility(true);
    const nextState = !showRoomInfo;
    const payloadNoticeText = `${noticeText}\n__ROOM_PUBLIC:${nextState}__`;
    try {
      const res = await fetch('/api/student/update-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          target_student_id: 'all',
          new_notice_text: payloadNoticeText
        })
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || '설정 변경 실패');

      toast.success(nextState ? '호실 정보가 전체 공개되었습니다.' : '호실 정보가 비공개 처리되었습니다.');
      setShowRoomInfo(nextState);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsUpdatingVisibility(false);
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
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold text-white px-2 py-0.5 rounded shadow-sm ${isPersonalNotice ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`}>
                {isPersonalNotice ? '💌 개인 편지' : '홍지관 안내문'}
              </span>
              {(showRoomInfo || isNoticeAdmin) && (
                <span className="text-sm md:text-base font-extrabold text-amber-900">{bedInfoText}</span>
              )}
              {isNoticeAdmin && (
                <button
                  onClick={handleToggleRoomVisibility}
                  disabled={isUpdatingVisibility}
                  className={`text-xs px-2 py-0.5 rounded font-bold transition whitespace-nowrap ml-1 ${
                    showRoomInfo 
                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' 
                      : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                  }`}
                  title="호실 정보 공개/비공개 설정"
                >
                  {isUpdatingVisibility ? '...' : showRoomInfo ? '🟢 공개' : '🔴 비공개'}
                </button>
              )}
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                <label className="flex items-center gap-1.5 text-xs text-amber-900 font-bold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sendPushNotification}
                    onChange={(e) => setSendPushNotification(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-amber-300 accent-amber-500 cursor-pointer"
                  />
                  <span>📱 푸시 알림 함께 발송하기</span>
                </label>
                <div className="flex justify-end gap-2 shrink-0">
                  <button onClick={() => setIsEditingNotice(false)} className="px-3 py-1 bg-gray-200 text-gray-700 text-xs font-bold rounded hover:bg-gray-300 cursor-pointer">취소</button>
                  <button onClick={handleSaveNotice} disabled={isSavingNotice} className="px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded hover:bg-amber-600 disabled:opacity-50 cursor-pointer">
                    {isSavingNotice ? '저장 중...' : '저장하기'}
                  </button>
                </div>
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
          <AnniversaryBanner type="student" />
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
