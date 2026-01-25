'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/supabaseClient';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { Student, Teacher, LeaveRequest } from '@/components/student/types';
import { LeaveRequestForm } from '@/components/student/LeaveRequestForm';
import { LeaveStatusList } from '@/components/student/LeaveStatusList';
import WeeklyReturnApplicationCard from '@/components/student/WeeklyReturnApplicationCard';
import { NotificationPermissionBanner } from '@/components/NotificationPermissionBanner';
import PullToRefresh from '@/components/PullToRefresh';

export default function StudentPage() {
  const [studentId, setStudentId] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [initialFormData, setInitialFormData] = useState<any>(null); // State for Copy functionality
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
      return () => { supabase.removeChannel(channel); };
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

  const currentStudent = students.find(s => s.student_id === studentId) || null;

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

      {/* Header with Logout */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-gray-800">
          {currentStudent?.name || studentId} 학생
        </h1>
      </div>

      <PullToRefresh onRefresh={() => studentId ? fetchLeaveRequests(studentId) : Promise.resolve()}>
        <div className="flex flex-col gap-8">
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
