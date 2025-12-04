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
  const [originalStudents, setOriginalStudents] = useState<Student[]>([]); // ★ 원본 저장

  const grades = [1, 2, 3];
  const classes = [1, 2, 3];
  const numbers = Array.from({ length: 22 }, (_, i) => i + 1);

  useEffect(() => {
    fetchStudents();
  }, []);

  // ===============================
  // 학생 데이터 fetch
  // ===============================
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
      setOriginalStudents(formatted); // ★ 원본 저장
    }
  };

  // ===============================
  // 단일 이름 변경
  // ===============================
  const handleNameChange = (grade: number, cls: number, num: number, value: string) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.grade === grade && s.class === cls && s.number === num
          ? { ...s, name: value }
          : s
      )
    );
  };

  // ===============================
  // 엑셀 여러 줄 붙여넣기 처리
  // ===============================
  const handleBulkPaste = (grade: number, cls: number, startNum: number, text: string) => {
    const lines = text.trim().split(/\r?\n/);

    setStudents((prev) =>
      prev.map((s) => {
        if (s.grade === grade && s.class === cls && s.number >= startNum) {
          const offset = s.number - startNum;
          return {
            ...s,
            name: lines[offset] !== undefined ? lines[offset] : s.name,
          };
        }
        return s;
      })
    );
  };

  // ===============================
  // 매주귀가 toggle
  // ===============================
  const handleWeekendToggle = (grade: number, cls: number, num: number) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.grade === grade && s.class === cls && s.number === num
          ? { ...s, weekend: !s.weekend }
          : s
      )
    );
  };

  // ===============================
  // 변경 감지 후 저장
  // ===============================
  const handleSave = async () => {
    // ★ 변경된 학생만 필터링
    const changed = students.filter((s, idx) => {
      const o = originalStudents[idx];
      return s.name !== o.name || s.weekend !== o.weekend;
    });

    if (changed.length === 0) {
      toast("변경된 내용이 없습니다.");
      return;
    }

    // Supabase에 변경된 학생만 저장
    const { error } = await supabase.from("students").upsert(changed, {
      onConflict: ["grade", "class", "number"],
    });

    if (error) {
      console.error(error);
      toast.error("저장 실패");
      return;
    }

    toast.success(`변경된 ${changed.length}명 저장 완료!`);
    setOriginalStudents(students); // ★ 변경 후 원본 업데이트
    fetchStudents(); // 최신 데이터 다시 fetch
  };

  // ===============================
  // 초기화
  // ===============================
  const handleReset = async () => {
    const resetStudents = students.map((s) => ({
      ...s,
      name: "",
      weekend: false,
    }));

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
                          onPaste={(e) => {
                            e.preventDefault();
                            const text = e.clipboardData.getData("text/plain");
                            handleBulkPaste(grade, cls, num, text);
                          }}
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
