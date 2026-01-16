'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { LeaveProcessList } from '@/components/teacher/LeaveProcessList';
import { LeaveRequest } from '@/components/teacher/types';

export default function TeacherPage() {
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState<string>('');
  const [teacherPosition, setTeacherPosition] = useState<string>(''); // Added state for position
  const [isLoading, setIsLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);

  const [showQR, setShowQR] = useState(false);
  const [origin, setOrigin] = useState('');

  const router = useRouter(); // Initialized useRouter

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const loginId = localStorage.getItem('dormichan_login_id') || sessionStorage.getItem('dormichan_login_id');
    const role = localStorage.getItem('dormichan_role') || sessionStorage.getItem('dormichan_role');

    console.log('[DEBUG_TEACHER] Session Check - ID:', loginId, 'Role:', role);

    if (!loginId || role !== 'teacher') {
      console.warn('[DEBUG_TEACHER] Invalid session. Redirecting to login.');
      router.push('/login');
      return;
    }

    setTeacherId(loginId); // Set teacherId from loginId if session is valid

    const resolveTeacherInfo = async () => {
      try {
        // The loginId and role are already checked above, so we can use them directly here.
        // const loginId = localStorage.getItem('dormichan_login_id') || sessionStorage.getItem('dormichan_login_id');
        // const role = localStorage.getItem('dormichan_role') || sessionStorage.getItem('dormichan_role');

        console.log('[DEBUG] resolving session:', { loginId, role });

        if (loginId && role === 'teacher') {
          console.log('[DEBUG] fetching teacher info for:', loginId);
          const { data: teacher, error } = await supabase
            .from('teachers')
            .select('id, name, position') // Added position
            .eq('teacher_id', loginId)
            .single();

          if (error) {
            console.error('[DEBUG] teacher fetch error:', error);
          }

          if (teacher) {
            console.log('[DEBUG] teacher found:', teacher);
            setTeacherId(teacher.id);
            setTeacherName(teacher.name);
            setTeacherPosition(teacher.position); // Set position
            await fetchLeaveRequests(teacher.id, teacher.name);
          } else {
            console.error('[DEBUG] Teacher record not found in teachers table for login ID:', loginId);
            toast.error('교사 정보를 찾을 수 없습니다. 관리자에게 문의하세요.');
          }
        } else {
          console.log('[DEBUG] No valid session found');
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

    const channel = supabase
      .channel('leave_requests_teacher_global')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leave_requests' },
        () => {
          console.log('Realtime update detected for teacher (leave_requests), refetching...');
          fetchLeaveRequests(teacherId, teacherName);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leave_request_students' },
        () => {
          console.log('Realtime update detected for teacher (leave_request_students), refetching...');
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
      console.log('Fetching all requests for teacher view...');

      // 0. Fetch Teachers Map manually
      const { data: teachersData } = await supabase.from('teachers').select('id, name');
      const teacherMap = new Map();
      teachersData?.forEach((t: { id: string; name: string }) => {
        teacherMap.set(t.id, t.name);
      });

      // Optimized fetch: Get ALL requests (Without broken Teacher Join)
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*, leave_request_students(student_id)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase query error:', error.message, error.details);
        throw error;
      }

      // Transform data
      const requestsWithDetails = (data || []).map((req) => ({
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

      // ---------------------------------------------------------
      // Push Notification Logic
      // ---------------------------------------------------------
      const targetRequest = leaveRequests.find(r => r.id === requestId);
      if (targetRequest) {
        const studentIds: string[] = [];

        // 1. Collect Student IDs (Single or Group)
        if (targetRequest.student_id) studentIds.push(targetRequest.student_id);
        if (targetRequest.leave_request_students) {
          targetRequest.leave_request_students.forEach(s => studentIds.push(s.student_id));
        }

        // 2. Fetch Subscriptions & Send Push
        if (studentIds.length > 0) {
          const { data: subs } = await supabase
            .from('push_subscriptions')
            .select('subscription_json')
            .in('student_id', studentIds);

          if (subs && subs.length > 0) {
            const message = `자녀의 [${targetRequest.leave_type}] 신청이 '${newStatus}' 되었습니다.`;

            // Send in parallel
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

            console.log(`Sent push notifications to ${subs.length} parents.`);
          }
        }
      }
      // ---------------------------------------------------------

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

      {/* Admin Button for authorized teachers */}
      <div className="flex justify-end mb-4 gap-2">
        <button
          onClick={() => setShowQR(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-xl shadow-lg transition-all flex items-center gap-2"
        >
          <span>📲</span>
          <span>앱 설치 QR</span>
        </button>

        <button
          onClick={() => router.push('/teacher/headcount')}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-xl shadow-lg transition-all flex items-center gap-2"
        >
          <img src="/bed-icon.png" alt="취침" className="w-6 h-6 rounded-full" />
          <span>취침인원</span>
        </button>

        {teacherPosition === '관리자' && (
          <button
            onClick={() => router.push('/admin')}
            className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-xl shadow-lg transition-all flex items-center gap-2"
          >
            <span>🔧</span>
            <span>관리자</span>
          </button>
        )}
      </div>



      <LeaveProcessList
        leaveRequests={leaveRequests}
        onUpdateStatus={handleUpdateStatus}
        onCancel={handleCancelRequest}
        teacherName={teacherName}
        teacherId={teacherId}
      />

      {showQR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in" onClick={() => setShowQR(false)}>
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowQR(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              &times;
            </button>

            <div className="mb-6">
              <span className="text-4xl">📲</span>
            </div>

            <h3 className="text-2xl font-extrabold text-gray-800 mb-2">이석찬 앱 설치</h3>
            <p className="text-gray-500 mb-6 text-sm">
              학생들에게 카메라로 주소를 스캔하도록 안내해주세요.<br />
              자동으로 설치 페이지로 연결됩니다.
            </p>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-inner inline-block mb-4">
              {origin && <QRCodeSVG value={origin} size={200} level={"H"} includeMargin={true} />}
            </div>

            <div
              className="bg-gray-50 p-3 rounded-lg text-xs text-gray-500 break-all select-all cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => {
                navigator.clipboard.writeText(origin);
                toast.success('주소가 복사되었습니다.');
              }}
            >
              {origin}
            </div>
            <p className="text-xs text-gray-400 mt-2">클릭하여 주소 복사</p>

            <button
              onClick={() => setShowQR(false)}
              className="w-full mt-6 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
