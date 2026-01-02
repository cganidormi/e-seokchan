'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import { LeaveProcessList } from '@/components/teacher/LeaveProcessList';
import { LeaveRequest } from '@/components/teacher/types';

export default function TeacherPage() {
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);

  useEffect(() => {
    const resolveTeacherInfo = async () => {
      try {
        const loginId = localStorage.getItem('dormichan_login_id') || sessionStorage.getItem('dormichan_login_id');
        const role = localStorage.getItem('dormichan_role') || sessionStorage.getItem('dormichan_role');

        if (loginId && role === 'teacher') {
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

      const requestsWithStudents = await Promise.all((data || []).map(async (req) => {
        const { data: students } = await supabase
          .from('leave_request_students')
          .select('student_id')
          .eq('leave_request_id', req.id);
        return { ...req, leave_request_students: students || [] };
      }));

      setLeaveRequests(requestsWithStudents as LeaveRequest[]);
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

  return (
    <div className="p-4 md:p-6 bg-gray-100 min-h-screen">
      <Toaster />
      <LeaveProcessList
        leaveRequests={leaveRequests}
        onUpdateStatus={handleUpdateStatus}
        onCancel={handleCancelRequest}
        teacherName={teacherName}
      />
    </div>
  );
}
