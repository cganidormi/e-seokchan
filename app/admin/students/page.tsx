"use client";

import { useState } from "react";

type Student = {
  id: number;
  name: string;
  grade: string;
  classNum: string;
};

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [classNum, setClassNum] = useState("");
  const [editId, setEditId] = useState<number | null>(null);

  // 학생 추가/수정
  const handleSave = () => {
    if (!name || !grade || !classNum) return alert("모든 필드를 입력하세요.");
    
    if (editId !== null) {
      // 수정
      setStudents(students.map(s => s.id === editId ? { ...s, name, grade, classNum } : s));
      setEditId(null);
    } else {
      // 추가
      const newStudent: Student = {
        id: Date.now(),
        name,
        grade,
        classNum,
      };
      setStudents([...students, newStudent]);
    }

    setName("");
    setGrade("");
    setClassNum("");
  };

  // 학생 삭제
  const handleDelete = (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    setStudents(students.filter(s => s.id !== id));
  };

  // 학생 편집
  const handleEdit = (student: Student) => {
    setName(student.name);
    setGrade(student.grade);
    setClassNum(student.classNum);
    setEditId(student.id);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">학생 관리 페이지</h1>

      {/* 학생 입력폼 */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="p-2 border rounded"
        />
        <input
          type="text"
          placeholder="학년"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          className="p-2 border rounded"
        />
        <input
          type="text"
          placeholder="반"
          value={classNum}
          onChange={(e) => setClassNum(e.target.value)}
          className="p-2 border rounded"
        />
        <button
          onClick={handleSave}
          className="bg-black text-white px-4 rounded"
        >
          {editId !== null ? "수정" : "추가"}
        </button>
      </div>

      {/* 학생 리스트 */}
      <table className="w-full border-collapse border border-gray-300">
        <thead className="bg-gray-200">
          <tr>
            <th className="border p-2">이름</th>
            <th className="border p-2">학년</th>
            <th className="border p-2">반</th>
            <th className="border p-2">액션</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id}>
              <td className="border p-2">{s.name}</td>
              <td className="border p-2">{s.grade}</td>
              <td className="border p-2">{s.classNum}</td>
              <td className="border p-2 flex gap-2">
                <button
                  onClick={() => handleEdit(s)}
                  className="bg-yellow-400 px-2 rounded"
                >
                  수정
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="bg-red-500 text-white px-2 rounded"
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
