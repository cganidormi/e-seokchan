"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/supabaseClient";
import toast, { Toaster } from "react-hot-toast";

interface Student {
  grade: number;
  class: number;
  number: number;
  name: string;
  weekend: boolean;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);

  const grades = [1, 2, 3];
  const classes = [1, 2, 3];
  const numbers = Array.from({ length: 22 }, (_, i) => i + 1);

  useEffect(() => {
    fetchStudents();
  }, []);

  // DB에서 학생 정보 fetch
  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .order("grade")
      .order("class")
      .order("number");
    if (error) {
      console.error(error);
      toast.error("학생 정보 불러오기 실패");
      return;
    }

    if (data) {
      const formatted: Student[] = [];
      grades.forEach((grade) =>
        classes.forEach((cls) =>
          numbers.forEach((num) => {
            const s = data.find(
              (d) => d.grade === grade && d.class === cls && d.number === num
            );
            formatted.push({
              grade,
              class: cls,
              number: num,
              name: s?.name || "",
              weekend: s?.weekend || false,
            });
          })
        )
      );
      setStudents(formatted);
    }
  };

  // 이름 변경
  const handleNameChange = (grade: number, cls: number, num: number, value: string) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.grade === grade && s.class === cls && s.number === num
          ? { ...s, name: value }
          : s
      )
    );
  };

  // 매주귀가 toggle
  const handleWeekendToggle = (grade: number, cls: number, num: number) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.grade === grade && s.class === cls && s.number === num
          ? { ...s, weekend: !s.weekend }
          : s
      )
    );
  };

  // 저장 (batch upsert)
  const handleSave = async () => {
    const { error } = await supabase.from("students").upsert(students, {
      onConflict: ["grade", "class", "number"],
    });
    if (error) {
      console.error(error);
      toast.error("저장 실패");
      return;
    }
    toast.success("저장 완료!");
    fetchStudents();
  };

  // 초기화
  const handleReset = async () => {
    const resetStudents = students.map((s) => ({ ...s, name: "", weekend: false }));
    setStudents(resetStudents);

    const { error } = await supabase.from("students").upsert(resetStudents, {
      onConflict: ["grade", "class", "number"],
    });
    if (error) {
      console.error(error);
      toast.error("초기화 실패");
      return;
    }
    toast.success("초기화 완료!");
    fetchStudents();
  };

  const getStudentNumber = (grade: number, cls: number, num: number) =>
    grade * 1000 + cls * 100 + num;

  return (
    <div className="p-4 space-y-8 overflow-x-auto">
      <Toaster position="top-right" />
      {grades.map((grade) => (
        <div key={grade}>
          <div className="flex items-center mb-4 gap-2">
            <h2 className="font-bold text-xl text-gray-800">{grade}학년</h2>
            <button
              onClick={handleSave}
              className="px-3 py-1 bg-gray-200 rounded-xl shadow-inner hover:shadow-md hover:bg-gray-100 transition text-sm"
            >
              저장
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-1 bg-red-200 rounded-xl shadow-inner hover:shadow-md hover:bg-red-100 transition text-sm"
            >
              초기화
            </button>
          </div>

          <div className="flex flex-wrap gap-3 min-w-max">
            {classes.map((cls) => (
              <div
                key={cls}
                className="min-w-[200px] p-3 rounded-xl bg-gray-100 shadow-inner flex-shrink-0"
              >
                <h3 className="font-semibold mb-2 text-gray-700">{cls}반</h3>
                <div className="flex flex-col gap-2">
                  {numbers.map((num) => {
                    const student = students.find(
                      (s) => s.grade === grade && s.class === cls && s.number === num
                    );
                    if (!student) return null;

                    return (
                      <div key={num} className="flex items-center gap-2 flex-wrap">
                        <span className="w-12 text-right text-sm text-gray-600">
                          {getStudentNumber(grade, cls, num)}
                        </span>
                        <input
                          type="text"
                          value={student.name}
                          onChange={(e) =>
                            handleNameChange(grade, cls, num, e.target.value)
                          }
                          className="flex-1 max-w-[80px] px-2 py-1 rounded-lg border border-gray-300 shadow-inner text-sm focus:shadow-md focus:outline-none transition"
                        />
                        <label className="flex items-center gap-1 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={student.weekend}
                            onChange={() => handleWeekendToggle(grade, cls, num)}
                            className="w-4 h-4 cursor-pointer"
                          />
                          <span className="text-sm">매주</span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
