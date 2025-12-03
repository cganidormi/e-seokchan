'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import clsx from 'clsx';

interface Student {
  id: number;
  name: string;
  grade: number;
  class: number;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState<number>(1);
  const [classNum, setClassNum] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  // 학생 목록 불러오기
  const fetchStudents = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('students').select('*').order('id', { ascending: true });
    if (error) console.log('학생 조회 에러:', error);
    else setStudents(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // 학생 추가
  const addStudent = async () => {
    if (!name) return alert('이름을 입력하세요');
    const { data, error } = await supabase
      .from('students')
      .insert([{ name, grade, class: classNum }]);

    if (error) {
      console.log('학생 추가 에러:', error);
      alert('학생 추가 실패: ' + error.message);
    } else {
      console.log('추가 완료:', data);
      setName('');
      setGrade(1);
      setClassNum(1);
      fetchStudents(); // 테이블 업데이트
    }
  };

  // 학생 삭제
  const deleteStudent = async (id: number) => {
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) {
      console.log('학생 삭제 에러:', error);
      alert('삭제 실패: ' + error.message);
    } else {
      fetchStudents();
    }
  };

  const inputClass = 'p-2 rounded border border-gray-300 focus:outline-none';

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-4">학생 관리</h1>

      {/* 학생 추가 폼 */}
      <div className="flex gap-2 mb-4 items-end">
        <input
          type="text"
          placeholder="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        <input
          type="number"
          placeholder="학년"
          value={grade}
          onChange={(e) => setGrade(Number(e.target.value))}
          min={1}
          max={3}
          className={inputClass}
        />
        <input
          type="number"
          placeholder="반"
          value={classNum}
          onChange={(e) => setClassNum(Number(e.target.value))}
          min={1}
          max={10}
          className={inputClass}
        />
        <button
          onClick={addStudent}
          className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
        >
          추가
        </button>
      </div>

      {/* 학생 테이블 */}
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-gray-300 p-2">ID</th>
            <th className="border border-gray-300 p-2">이름</th>
            <th className="border border-gray-300 p-2">학년</th>
            <th className="border border-gray-300 p-2">반</th>
            <th className="border border-gray-300 p-2">삭제</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={5} className="text-center p-4">로딩 중...</td>
            </tr>
          ) : students.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center p-4">학생 데이터 없음</td>
            </tr>
          ) : (
            students.map((s) => (
              <tr key={s.id}>
                <td className="border border-gray-300 p-2">{s.id}</td>
                <td className="border border-gray-300 p-2">{s.name}</td>
                <td className="border border-gray-300 p-2">{s.grade}</td>
                <td className="border border-gray-300 p-2">{s.class}</td>
                <td className="border border-gray-300 p-2">
                  <button
                    onClick={() => deleteStudent(s.id)}
                    className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
