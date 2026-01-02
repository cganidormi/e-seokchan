'use client';

import { useState, useEffect } from 'react';
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

  useEffect(() => {
    const loginId = localStorage.getItem('dormichan_login_id') || sessionStorage.getItem('dormichan_login_id');
    if (loginId) setStudentId(loginId);

    // Initial data fetch
    const fetchData = async () => {
      const { data: studentsData } = await supabase.from('students').select('*');
      if (studentsData) setStudents(studentsData as Student[]);

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
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, []);

  const fetchLeaveRequests = async (id: string) => {
    try {
      const { data: mainRequests } = await supabase.from('leave_requests').select('*').eq('student_id', id).neq('status', '취소');
      const { data: coStudentData } = await supabase.from('leave_request_students').select('leave_request_id').eq('student_id', id);
      const coRequestIds = coStudentData?.map(c => c.leave_request_id) || [];

      let coRequests: any[] = [];
      if (coRequestIds.length > 0) {
        const { data: fetchedCoRequests } = await supabase.from('leave_requests').select('*').in('id', coRequestIds).neq('status', '취소');
        coRequests = fetchedCoRequests || [];
      }

      const allRequestIds = new Set([...(mainRequests?.map(r => r.id) || []), ...coRequests.map(r => r.id)]);
      const combinedRequests = [...(mainRequests || []), ...coRequests].filter(r => {
        if (allRequestIds.has(r.id)) {
          allRequestIds.delete(r.id);
          return true;
        }
        return false;
      });

      combinedRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Fetch details
      const { data: allTeachers } = await supabase.from('teachers').select('id, name');
      const requestsWithDetails = await Promise.all(
        combinedRequests.map(async (req) => {
          const { data: additionalStudents } = await supabase.from('leave_request_students').select('student_id').eq('leave_request_id', req.id);
          const teacher = allTeachers?.find(t => t.id === req.teacher_id);
          return { ...req, teachers: teacher ? { name: teacher.name } : null, leave_request_students: additionalStudents || [] };
        })
      );

      setLeaveRequests(requestsWithDetails as any[]);
    } catch (err) {
      console.error('Fetch error:', err);
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
        />
      </div>
    </div>
  );
}
