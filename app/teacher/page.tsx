'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { IoQrCode } from 'react-icons/io5';
import { LeaveProcessList } from '@/components/teacher/LeaveProcessList';
import { LeaveRequest } from '@/components/teacher/types';
import { NotificationPermissionBanner } from '@/components/NotificationPermissionBanner';
import PullToRefresh from '@/components/PullToRefresh';

export default function TeacherPage() {
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState<string>('');
  const [teacherPosition, setTeacherPosition] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [showQR, setShowQR] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const loginId = localStorage.getItem('dormichan_login_id') || sessionStorage.getItem('dormichan_login_id');
    const role = localStorage.getItem('dormichan_role') || sessionStorage.getItem('dormichan_role');

    if (!loginId || role !== 'teacher') {
      router.push('/login');
      return;
    }

    setTeacherId(loginId);

  }, [router]);

  useEffect(() => {
    const loginId = localStorage.getItem('dormichan_login_id') || sessionStorage.getItem('dormichan_login_id');
    const role = localStorage.getItem('dormichan_role') || sessionStorage.getItem('dormichan_role');

    const resolveTeacherInfo = async () => {
      try {
        if (loginId && role === 'teacher') {
          const { data: teacher, error } = await supabase
            .from('teachers')
            .select('id, name, position')
            .eq('teacher_id', loginId)
            .single();

          if (error) {
            console.error('[DEBUG] teacher fetch error:', error);
          }

          if (teacher) {
            setTeacherId(teacher.id);
            setTeacherName(teacher.name);
            setTeacherPosition(teacher.position);
            await fetchLeaveRequests(teacher.id, teacher.name);
          } else {
            console.error('[DEBUG] Teacher record not found in teachers table for login ID:', loginId);
            toast.error('교사 정보를 찾을 수 없습니다. 관리자에게 문의하세요.');
          }
        }
      } catch (err) {
        console.error('[DEBUG] Session resolution error:', err);
      } finally {
        const { data: studentData } = await supabase.from('students').select('*');
        if (studentData) setStudents(studentData);
        setIsLoading(false);
      }
    };

    resolveTeacherInfo();
  }, []);

  useEffect(() => {
    if (!teacherId || !teacherName) return;

    // Separate channels for clarity and reliability
    const channel1 = supabase
      .channel('teacher_main_requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leave_requests' },
        (payload) => {

          fetchLeaveRequests(teacherId, teacherName);
        }
      )
      .subscribe();

    const channel2 = supabase
      .channel('teacher_sub_students')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leave_request_students' },
        (payload) => {

          fetchLeaveRequests(teacherId, teacherName);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel1);
      supabase.removeChannel(channel2);
    };
  }, [teacherId, teacherName]);

  // 자동 알림 구독 시도
  useEffect(() => {
    const autoSubscribe = async () => {
      if (!teacherId) return;
      if (!('serviceWorker' in navigator)) return;

      try {
        const permission = Notification.permission;
        if (permission === 'granted') {
          // 이미 권한이 있으면 조용히 구독 갱신 시도
          const registration = await navigator.serviceWorker.ready;
          const sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
          });

          // DB 업데이트 (중복 무시됨 or 업데이트)
          await supabase.from('push_subscriptions').upsert({
            teacher_id: teacherId,
            subscription_json: sub
          }, { onConflict: 'teacher_id, subscription_json' }); // 단순화를 위해. 스키마에 따라 다를 수 있음. 실제로는 insert하고 에러 무시가 나음.
        }
      } catch (e) {

      }
    };

    autoSubscribe();
  }, [teacherId]);

  // Update App Icon Badge (Real-time while app is open)
  useEffect(() => {
    if ('setAppBadge' in navigator && 'clearAppBadge' in navigator && teacherId) {
      // Only count '신청' (Pending) status items ASSIGNED to this teacher
      const pendingCount = leaveRequests.filter(req =>
        (req.status === '신청' || req.status === '학부모승인') && req.teacher_id === teacherId
      ).length;

      if (pendingCount > 0) {
        (navigator as any).setAppBadge(pendingCount).catch((e: any) => console.error('Badge error:', e));
      } else {
        (navigator as any).clearAppBadge().catch((e: any) => console.error('Badge clear error:', e));
      }
    }
  }, [leaveRequests, teacherId]);

  const fetchLeaveRequests = async (id: string, name: string) => {
    try {

      const { data: teachersData } = await supabase.from('teachers').select('id, name');
      const teacherMap = new Map();
      teachersData?.forEach((t: { id: string; name: string }) => {
        teacherMap.set(t.id, t.name);
      });

      const { data, error } = await supabase
        .from('leave_requests')
        .select('*, leave_request_students(student_id)')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Supabase query error:', error.message, error.details);
        throw error;
      }

      const requestsWithDetails = (data || [])
        .filter((req) => {
          // 만료된 요청 필터링 (승인되지 않은 상태에서 시간이 지난 경우 숨김)
          // 단, '승인', '반려', '취소', '복귀' 등 완료된 상태는 기록을 위해 보여줄 수도 있지만, 
          // 선생님 요청사항은 "만료된 요청은 깔끔하게 삭제"이므로 
          // "처리되지 않은(Pending) 상태인데 이미 시간이 지난 것"만 안 보이게 처리함.
          // 완료된 건(승인/반려 등)은 히스토리로 남겨둠.

          const now = new Date();
          const endTime = new Date(req.end_time);
          const isExpired = now > endTime;
          const isPending = req.status === '신청' || req.status === '학부모승인대기' || req.status === '학부모승인' || req.status === '승인대기';

          // 만료되었고 아직 처리중(Pending)이면 숨김 (뱃지 카운트에서도 제외됨)
          if (isExpired && isPending) return false;

          return true;
        })
        .map((req) => ({
          ...req,
          teachers: req.teacher_id ? { name: teacherMap.get(req.teacher_id) || req.teacher_id } : { name: '-' },
        }));

      setLeaveRequests(requestsWithDetails as LeaveRequest[]);
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error('현황을 불러오지 못했습니다.');
    }
  };

  const handleUpdateStatus = async (requestId: string | number, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (error) throw error;

      toast.success(`상태가 ${newStatus}(으)로 변경되었습니다.`);

      const targetRequest = leaveRequests.find(r => r.id === requestId);
      if (targetRequest) {
        const studentIds: string[] = [];

        if (targetRequest.student_id) studentIds.push(targetRequest.student_id);
        if (targetRequest.leave_request_students) {
          targetRequest.leave_request_students.forEach(s => studentIds.push(s.student_id));
        }

        if (studentIds.length > 0) {
          const { data: subs } = await supabase
            .from('push_subscriptions')
            .select('subscription_json')
            .in('student_id', studentIds);

          if (subs && subs.length > 0) {
            let message = `자녀의 [${targetRequest.leave_type}] 신청이 '${newStatus}' 되었습니다.`;

            if (newStatus === '학부모승인대기') {
              message = `[${targetRequest.leave_type}] 선생님 승인 완료. 학부모님의 최종 승인이 필요합니다.`;
            } else if (newStatus === '학부모승인') {
              message = `[${targetRequest.leave_type}] 학부모님 승인 완료. 선생님의 최종 승인 대기 중입니다.`;
            } else if (newStatus === '승인') {
              message = `[${targetRequest.leave_type}] 최종 승인되었습니다. 즐거운 시간 보내세요!`;
            } else if (newStatus === '복귀') {
              message = `[${targetRequest.leave_type}] 학생이 기숙사로 복귀했습니다.`;
            } else if (newStatus === '반려') {
              message = `[${targetRequest.leave_type}] 신청이 반려되었습니다. 사유를 확인해주세요.`;
            }

            await Promise.all(subs.map(sub =>
              fetch('/api/web-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  subscription: sub.subscription_json,
                  message: message,
                  title: 'DormiCheck 알림'
                })
              }).catch(e => console.error('Push send error:', e))
            ));
          }
        }
      }

      if (teacherId && teacherName) {
        await fetchLeaveRequests(teacherId, teacherName);
      }
    } catch (err) {
      console.error('Update error:', err);
      toast.error('상태 변경에 실패했습니다.');
    }
  };

  const handleCancelRequest = async (requestId: string | number) => {
    if (!confirm('신청을 취소(삭제)하시겠습니까?')) return;

    const { error } = await supabase
      .from('leave_requests')
      .update({ status: '취소' })
      .eq('id', requestId);

    if (error) {
      toast.error('취소 실패');
    } else {
      toast.success('취소되었습니다.');
      if (teacherId && teacherName) fetchLeaveRequests(teacherId, teacherName);
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

  const handleLogout = () => {
    localStorage.removeItem('dormichan_login_id');
    localStorage.removeItem('dormichan_role');
    localStorage.removeItem('dormichan_keepLoggedIn');
    sessionStorage.removeItem('dormichan_login_id');
    sessionStorage.removeItem('dormichan_role');
    sessionStorage.removeItem('dormichan_keepLoggedIn');
    router.push('/login');
  };

  return (
    <div className="p-4 md:p-6 bg-gray-100 min-h-screen">
      <Toaster />

      {/* Persistent Notification Warning */}
      {teacherId && (
        <NotificationPermissionBanner userId={teacherId} userType="teacher" />
      )}

      {/* Admin Buttons & Refresh */}
      <div className="flex justify-end mb-4 gap-2">
        <button
          onClick={() => setShowQR(true)}
          className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 font-bold py-1.5 px-3 rounded-xl shadow-sm transition-all flex items-center justify-center text-sm"
          title="학생용 QR코드"
        >
          <IoQrCode className="w-5 h-5 text-gray-700" />
        </button>

        <button
          onClick={() => router.push(`/change-password?role=teacher&id=${teacherId}`)}
          className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 font-bold py-1.5 px-3 rounded-xl shadow-sm transition-all flex items-center justify-center text-sm"
          title="비밀번호 변경"
        >
          <span className="text-lg">🔒</span>
        </button>

        <button
          onClick={() => router.push('/today')}
          className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 font-bold py-1.5 px-4 rounded-xl shadow-sm transition-all flex items-center gap-2 text-sm"
        >
          <div className="p-[1.5px] rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500">
            <div className="p-[1.5px] bg-white rounded-full">
              <img src="/dorm.jpg" alt="Icon" className="w-5 h-5 rounded-full object-cover" />
            </div>
          </div>
          <span>오늘의 홍지관</span>
        </button>

        {teacherPosition === '관리자' && (
          <button
            onClick={() => router.push('/admin')}
            className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-xl shadow-lg transition-all flex items-center gap-2 text-sm"
          >
            <span>🔧</span>
            <span>관리자</span>
          </button>
        )}
      </div>

      <PullToRefresh onRefresh={() => teacherId && teacherName ? fetchLeaveRequests(teacherId, teacherName) : Promise.resolve()}>
        <LeaveProcessList
          leaveRequests={leaveRequests}
          onUpdateStatus={handleUpdateStatus}
          onCancel={handleCancelRequest}
          teacherName={teacherName}
          teacherId={teacherId}
        />
      </PullToRefresh>

      {/* QR Code Modal */}
      {showQR && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setShowQR(false)}
        >
          <div
            className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center space-y-6 transform transition-all scale-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900">이석찬 학생용</h3>
              <p className="text-sm text-gray-500 mt-1">학생들에게 아래 QR코드를 보여주세요</p>
            </div>

            <div className="p-4 bg-white rounded-xl border-2 border-gray-100 shadow-sm">
              <QRCodeSVG
                value="https://e-seokchan.vercel.app"
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="w-full">
              <button
                onClick={() => setShowQR(false)}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-2xl transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
