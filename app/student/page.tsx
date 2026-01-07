'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/supabaseClient';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { Student, Teacher, LeaveRequest } from '@/components/student/types';
import { LeaveRequestForm } from '@/components/student/LeaveRequestForm';
import { LeaveStatusList } from '@/components/student/LeaveStatusList';

export default function StudentPage() {
  const [studentId, setStudentId] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter(); // Initialized useRouter

  useEffect(() => {
    // 1. Session & Role Check
    const loginId = localStorage.getItem('dormichan_login_id') || sessionStorage.getItem('dormichan_login_id');
    const role = localStorage.getItem('dormichan_role') || sessionStorage.getItem('dormichan_role');

    console.log('[DEBUG_STUDENT] Session Check - ID:', loginId, 'Role:', role);

    if (!loginId || role !== 'student') {
      console.warn('[DEBUG_STUDENT] Invalid session. Redirecting to login.');
      router.push('/login');
      return;
    }

    setStudentId(loginId);
    console.log('[DEBUG_STUDENT] Session Valid. Loaded Student ID:', loginId);

    // Initial data fetch
    const fetchData = async () => {
      console.log('[DEBUG_PAGE] Fetching initial data...');
      const { data: studentsData } = await supabase.from('students').select('*');
      if (studentsData) {
        console.log(`[DEBUG_PAGE] Loaded ${studentsData.length} students`);
        setStudents(studentsData as Student[]);
      } else {
        console.error('[DEBUG_PAGE] Failed to load students');
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
          console.log('[DEBUG_PAGE] Realtime update detected (leave_requests)');
          fetchLeaveRequests(loginId);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_request_students' }, () => {
          console.log('[DEBUG_PAGE] Realtime update detected (leave_request_students)');
          fetchLeaveRequests(loginId);
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, []);

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
        .order('created_at', { ascending: false });

      if (publicError) {
        console.error('[DEBUG] Public Request Fetch Error:', JSON.stringify(publicError));
        throw publicError;
      }

      // 2. Fetch "Private" requests
      // 2a. Main
      const { data: myMainPrivateRequests, error: myMainError } = await supabase
        .from('leave_requests')
        .select('*, leave_request_students(student_id)')
        .eq('student_id', id)
        .in('leave_type', ['외출', '외박'])
        .order('created_at', { ascending: false });

      if (myMainError) {
        console.error('[DEBUG] My Main Private Fetch Error:', JSON.stringify(myMainError));
        throw myMainError;
      }

      // 2b. Co-applicant
      const { data: coLinkData } = await supabase
        .from('leave_request_students')
        .select('leave_request_id')
        .eq('student_id', id);

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
          console.error('[DEBUG] Co-student Private Fetch Error:', JSON.stringify(coError));
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
      console.error('Fetch error full object:', err);
      console.error('Fetch error message:', err.message || JSON.stringify(err));
    }
  };

  const handleCancelRequest = async (requestId: number) => {
    if (!confirm('신청을 취소하시겠습니까?')) return;
    const { error } = await supabase.from('leave_requests').update({ status: '취소' }).eq('id', requestId);
    if (error) {
      toast.error('취소 실패');
    } else {
      toast.success('취소되었습니다.');
      if (studentId) fetchLeaveRequests(studentId);
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

  return (
    <div className="p-4 md:p-6 bg-gray-100 min-h-screen">
      <Toaster />

      {/* Header with Logout */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-gray-800">
          {students.find(s => s.student_id === studentId)?.name || studentId} 학생
        </h1>
        <button
          onClick={handleLogout}
          className="bg-white border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          로그아웃
        </button>
      </div>

      <div className="flex flex-col gap-8">
        <LeaveRequestForm
          studentId={studentId}
          students={students}
          teachers={teachers}
          onSubmitSuccess={() => fetchLeaveRequests(studentId)}
        />
        <LeaveStatusList
          leaveRequests={leaveRequests}
          onCancel={handleCancelRequest}
          leaveTypes={['컴이석', '이석', '외출', '외박', '자리비움']}
          students={students}
          studentId={studentId}
        />
      </div>
    </div>
  );
}
