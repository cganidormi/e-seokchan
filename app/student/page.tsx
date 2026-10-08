'use client';

import { useState, useEffect, useCallback } from 'react';
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
import LoadingScreen from '@/components/LoadingScreen';

export default function StudentPage() {
  const [studentId, setStudentId] = useState('');
  const [actualLoginId, setActualLoginId] = useState('');
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

  // Reservation Notice State (3317 Admin)
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [pendingSchedules, setPendingSchedules] = useState<any[]>([]);

  const router = useRouter(); // Initialized useRouter

  useEffect(() => {
    // URL preview 파라미터 지원 (예: /student?preview=2101강동헌)
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const previewStudent = sp.get('preview');
      if (previewStudent) {
        localStorage.setItem('dormichan_login_id', previewStudent);
        localStorage.setItem('dormichan_role', 'student');
      }
    }

    // 1. Session & Role Check
    const loginId = localStorage.getItem('dormichan_login_id') || sessionStorage.getItem('dormichan_login_id');
    const role = localStorage.getItem('dormichan_role') || sessionStorage.getItem('dormichan_role');

    if (!loginId || role !== 'student') {
      router.push('/login');
      return;
    }

    // PWA 독립 실행 모드 검사 (일반 브라우저 학생 접속 차단)
    const isStandalone = typeof window !== 'undefined' && (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone ||
      document.referrer.includes('android-app://')
    );
    const isLocalhost = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    );
    const isMaster =
      loginId === '3317홍길동' ||
      loginId.startsWith('3317') ||
      loginId === '3318이순신' ||
      loginId.startsWith('3318');

    if (!isStandalone && !isLocalhost && !isMaster) {
      toast.error('학생은 웹 브라우저에서 이용할 수 없습니다. 앱으로 접속해주세요.', { duration: 5000 });
      router.replace('/');
      return;
    }

    setActualLoginId(loginId);
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

      // Periodic check for unapproved leave reminders for student
      const checkStudentReminders = () => {
        fetch('/api/cron/remind-unapproved-student', { method: 'POST' }).catch(e => console.error('Student remind check error:', e));
      };
      checkStudentReminders();
      const studentTimer = setInterval(checkStudentReminders, 2 * 60 * 1000);

      return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(studentsChannel);
        clearInterval(studentTimer);
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

    // Check due scheduled notices periodically every minute
    const checkScheduledDue = () => {
      fetch('/api/student/update-notice').catch(() => {});
    };
    const noticeInterval = setInterval(checkScheduledDue, 60 * 1000);

    return () => {
      supabase.removeChannel(noticeChannel);
      clearInterval(noticeInterval);
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
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const nowStr = new Date().toISOString();

      // Define optimized filter: Currently active OR created within the last 2 days
      const timeFilter = `end_time.gte.${nowStr},created_at.gte.${twoDaysAgo}`;

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

  const fetchPendingSchedules = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/student/update-notice?student_id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.scheduled_notices)) {
        setPendingSchedules(data.scheduled_notices);
      }
    } catch (e) {
      console.error('Failed to fetch pending schedules:', e);
    }
  }, []);

  useEffect(() => {
    if (actualLoginId && (actualLoginId === '3317홍길동' || actualLoginId.startsWith('3317'))) {
      fetchPendingSchedules(actualLoginId);

      const scheduledNoticeChannel = supabase
        .channel('public:system_settings:scheduled_notices')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'system_settings', filter: 'setting_key=eq.scheduled_student_notices' },
          () => {
            fetchPendingSchedules(actualLoginId);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(scheduledNoticeChannel);
      };
    }
  }, [actualLoginId, fetchPendingSchedules]);

  const handleCancelSchedule = async (scheduledId: string) => {
    if (!confirm('예약된 공지를 취소하시겠습니까?')) return;
    try {
      const res = await fetch('/api/student/update-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: actualLoginId || studentId,
          action: 'cancel_schedule',
          scheduled_id: scheduledId
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '취소 실패');
      toast.success('예약이 성공적으로 취소되었습니다.');
      if (actualLoginId) fetchPendingSchedules(actualLoginId);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleSaveNotice = async () => {
    if (!editNoticeContent.trim()) {
      toast.error('안내 내용을 입력해주세요.');
      return;
    }

    if (isScheduled) {
      if (!scheduledDateTime) {
        toast.error('예약 일시를 선택해주세요.');
        return;
      }
      const schedTime = new Date(scheduledDateTime).getTime();
      if (isNaN(schedTime) || schedTime <= Date.now()) {
        toast.error('예약 일시는 현재 시간 이후여야 합니다.');
        return;
      }
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
          student_id: actualLoginId || studentId,
          target_student_id: targetStudentId,
          new_notice_text: payloadNoticeText,
          send_push: sendPushNotification,
          is_scheduled: isScheduled,
          scheduled_at: isScheduled ? new Date(scheduledDateTime).toISOString() : undefined
        })
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || '저장 실패');

      if (isScheduled) {
        const formattedDate = new Date(scheduledDateTime).toLocaleString('ko-KR', {
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        toast.success(`공지가 ${formattedDate}에 예약되었습니다.`);
        if (actualLoginId) fetchPendingSchedules(actualLoginId);
      } else {
        if (sendPushNotification) {
          toast.success(targetStudentId === 'all' ? '전체 공지가 업데이트되고 푸시 알림이 발송되었습니다.' : '개별 공지가 업데이트되고 푸시 알림이 발송되었습니다.');
        } else {
          toast.success('공지 내용만 조용히 업데이트되었습니다. (푸시 알림 미발송)');
        }

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
      }
      setIsEditingNotice(false);
      setIsScheduled(false);
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
    return <LoadingScreen />;
  }

  const handleSwitchStudent = (newId: string) => {
    setStudentId(newId);
    fetchLeaveRequests(newId);
    toast.success(`${newId} 학생 화면으로 전환되었습니다.`);
  };

  const currentStudent = students.find(s => s.student_id === studentId) || null;
  const actualLoginStudent = students.find(s => s.student_id === actualLoginId) || null;
  const isMasterAdmin =
    (actualLoginStudent?.grade === 3 && actualLoginStudent?.class === 3 && actualLoginStudent?.number === 17 && actualLoginStudent?.name === '홍길동') ||
    (actualLoginStudent?.grade === 3 && actualLoginStudent?.class === 3 && actualLoginStudent?.number === 18 && actualLoginStudent?.name === '이순신') ||
    actualLoginId === '3317홍길동' ||
    actualLoginId === '3318이순신';
  const isNoticeAdmin = isMasterAdmin;

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
        <NotificationPermissionBanner userId={actualLoginId || studentId} userType="student" />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center mb-6 gap-3 md:gap-5 w-full">
        <div className="flex items-center justify-between w-full md:w-auto shrink-0 gap-3">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span>{currentStudent?.name || studentId} 학생</span>
            {isMasterAdmin && studentId !== actualLoginId && (
              <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                대리/조회 모드
              </span>
            )}
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
        <div className="bg-white border border-[#FF6F61]/60 rounded-xl p-3 shadow-sm w-full md:w-auto md:max-w-2xl relative">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold text-white px-2 py-0.5 rounded shadow-sm ${isPersonalNotice ? 'bg-red-500 animate-pulse' : 'bg-[#FF6F61]'}`}>
                {isPersonalNotice ? '💌 개인 편지' : '홍지관 안내문'}
              </span>
              {(showRoomInfo || isNoticeAdmin) && (
                <span className="text-sm md:text-base font-extrabold text-[#c04b40]">{bedInfoText}</span>
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
                  setIsScheduled(false);
                  setIsEditingNotice(true);
                }}
                className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded font-bold hover:bg-amber-200 transition whitespace-nowrap ml-2 cursor-pointer"
              >
                ✏️ 수정 / 예약
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

              {/* 게시 방식 선택: 즉시 게시 vs 예약 게시 */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-700">게시 방식:</span>
                  <button
                    type="button"
                    onClick={() => setIsScheduled(false)}
                    className={`text-xs px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                      !isScheduled
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-white border border-amber-300 text-gray-700 hover:bg-amber-100'
                    }`}
                  >
                    ⚡ 즉시 게시
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsScheduled(true);
                      if (!scheduledDateTime) {
                        const d = new Date(Date.now() + 60 * 60 * 1000);
                        d.setMinutes(Math.ceil(d.getMinutes() / 10) * 10, 0, 0);
                        const pad = (n: number) => n.toString().padStart(2, '0');
                        setScheduledDateTime(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
                      }
                    }}
                    className={`text-xs px-2.5 py-1 rounded-md font-bold transition cursor-pointer flex items-center gap-1 ${
                      isScheduled
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-white border border-amber-300 text-gray-700 hover:bg-amber-100'
                    }`}
                  >
                    ⏰ 예약 게시
                  </button>
                </div>

                {/* 예약 시간 설정 */}
                {isScheduled && (
                  <div className="pt-1.5 border-t border-amber-200 space-y-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                      <label className="text-xs font-bold text-amber-900 shrink-0">
                        📅 예약 일시:
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduledDateTime}
                        onChange={(e) => setScheduledDateTime(e.target.value)}
                        min={(() => {
                          const now = new Date();
                          const pad = (n: number) => n.toString().padStart(2, '0');
                          return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
                        })()}
                        className="text-xs p-1.5 border border-amber-300 rounded bg-white font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <p className="text-[11px] text-amber-800 font-medium">
                      ※ 설정한 시각에 자동으로 학생 전광판에 반영되며, 알림 체크 시 푸시 알림도 예약 시간에 맞춰 전송됩니다.
                    </p>
                  </div>
                )}
              </div>

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
                  <button onClick={() => { setIsEditingNotice(false); setIsScheduled(false); }} className="px-3 py-1 bg-gray-200 text-gray-700 text-xs font-bold rounded hover:bg-gray-300 cursor-pointer">취소</button>
                  <button onClick={handleSaveNotice} disabled={isSavingNotice} className="px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded hover:bg-amber-600 disabled:opacity-50 cursor-pointer">
                    {isSavingNotice ? (isScheduled ? '예약 저장 중...' : '저장 중...') : (isScheduled ? '⏰ 예약 저장' : '저장하기')}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className={`text-xs md:text-sm break-keep leading-relaxed font-medium whitespace-pre-wrap ${isPersonalNotice ? 'text-red-700 font-bold' : 'text-gray-700'}`}>
              {displayNoticeText}
            </p>
          )}

          {/* 3317 관리자 모드: 대기 중인 예약 공지 목록 표시 */}
          {isNoticeAdmin && !isEditingNotice && pendingSchedules.length > 0 && (
            <div className="mt-3 pt-2 border-t border-amber-200/80">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                  ⏰ 게시 대기 중인 예약 ({pendingSchedules.length}건)
                </span>
              </div>
              <div className="space-y-1.5">
                {pendingSchedules.map(sch => {
                  const targetStudent = students.find(s => s.student_id === sch.target_student_id);
                  const targetLabel = sch.target_student_id === 'all'
                    ? '전체 학생'
                    : targetStudent ? `${targetStudent.grade}-${targetStudent.class} ${targetStudent.name}` : sch.target_student_id;
                  const cleanText = sch.notice_text.replace(/\n?__ROOM_PUBLIC:(true|false)__/, '').trim();
                  const dateStr = new Date(sch.scheduled_at).toLocaleString('ko-KR', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                  });

                  return (
                    <div key={sch.id} className="flex items-center justify-between bg-amber-50/80 border border-amber-200 rounded-md p-2 gap-2 text-xs">
                      <div className="truncate flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-extrabold text-amber-800">[{dateStr} 게시 예정]</span>
                          <span className="bg-amber-200/80 text-amber-900 px-1.5 py-0.2 rounded text-[10px] font-bold">
                            {targetLabel}
                          </span>
                          {sch.send_push && (
                            <span className="text-[10px] text-blue-600 font-bold">📱 알림발송</span>
                          )}
                        </div>
                        <p className="text-gray-700 truncate font-medium">{cleanText}</p>
                      </div>
                      <button
                        onClick={() => handleCancelSchedule(sch.id)}
                        className="bg-red-100 hover:bg-red-200 text-red-700 px-2.5 py-1 rounded text-xs font-bold transition shrink-0 cursor-pointer"
                        title="예약 취소"
                      >
                        취소
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
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
            actualLoginId={actualLoginId}
            onSwitchStudent={handleSwitchStudent}
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
