'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import { LeaveProcessList } from '@/components/teacher/LeaveProcessList';
import { LeaveRequest } from '@/components/teacher/types';

export default function TeacherPage() {
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState<string>('');
  const [teacherPosition, setTeacherPosition] = useState<string>(''); // Added state for position
  const [isLoading, setIsLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);

  const router = useRouter(); // Initialized useRouter

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
      {teacherPosition === '관리자' && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => router.push('/admin')}
            className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-xl shadow-lg transition-all flex items-center gap-2"
          >
            <span>🔧</span>
            <span>관리자 페이지</span>
          </button>
        </div>
      )}



      <LeaveProcessList
        leaveRequests={leaveRequests}
        onUpdateStatus={handleUpdateStatus}
        onCancel={handleCancelRequest}
        teacherName={teacherName}
        teacherId={teacherId}
      />
    </div>
  );
}
