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
  const [originalStudents, setOriginalStudents] = useState<Student[]>([]);

  const grades = [1, 2, 3];
  const classes = [1, 2, 3];
  const numbers = Array.from({ length: 22 }, (_, i) => i + 1);

  useEffect(() => {
    fetchStudents();
  }, []);

  // -------------------------
  // 임시 비밀번호 (4숫자 + 2영문)
  // -------------------------
  const generateTempPassword = () => {
    const num = Math.floor(1000 + Math.random() * 9000).toString();
    const letters = Array.from({ length: 2 }, () =>
      String.fromCharCode(65 + Math.floor(Math.random() * 26))
    ).join("");
    return num + letters;
  };

  // -------------------------
  // 학생 데이터 불러오기
  // -------------------------
  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .order("grade")
      .order("class")
      .order("number");

    if (error) {
      toast.error("학생 데이터 로드 실패");
      return;
    }

    if (data) {
      const fullList: Student[] = [];

      grades.forEach((g) =>
        classes.forEach((c) =>
          numbers.forEach((n) => {
            const found = data.find(
              (s) => s.grade === g && s.class === c && s.number === n
            );
            fullList.push({
              grade: g,
              class: c,
              number: n,
              name: found?.name || "",
              weekend: found?.weekend || false,
            });
          })
        )
      );

      setStudents(fullList);
      setOriginalStudents(fullList);
    }
  };

  // -------------------------
  // 이름 변경
  // -------------------------
  const handleNameChange = (
    grade: number,
    cls: number,
    num: number,
    value: string
  ) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.grade === grade && s.class === cls && s.number === num
          ? { ...s, name: value }
          : s
      )
    );
  };

  // -------------------------
  // 매주귀가 토글
  // -------------------------
  const handleWeekendToggle = (grade: number, cls: number, num: number) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.grade === grade && s.class === cls && s.number === num
          ? { ...s, weekend: !s.weekend }
          : s
      )
    );
  };

  // -------------------------
  // 저장 (students + students_auth)
  // -------------------------
  const handleSave = async () => {
    const changed = students.filter((s, idx) => {
      const o = originalStudents[idx];
      return s.name !== o.name || s.weekend !== o.weekend;
    });

    if (changed.length === 0) {
      toast("변경된 내용이 없습니다.");
      return;
    }

    // student_id 생성 (이름 없을 때는 계정 생성 X)
    const toStudentId = (s: Student) =>
      s.name && s.name.trim().length > 0
        ? `${s.grade}${s.class}${String(s.number).padStart(2, "0")}${s.name}`
        : null;

    // -------------------------
    // students 업데이트
    // -------------------------
    const studentsUpserts = changed.map((s) => ({
      grade: s.grade,
      class: s.class,
      number: s.number,
      name: s.name,
      weekend: s.weekend,
      student_id: toStudentId(s),
    }));

    const { error: studentsErr } = await supabase
      .from("students")
      .upsert(studentsUpserts, { onConflict: ["grade", "class", "number"] });

    if (studentsErr) {
      toast.error("학생 정보 저장 실패");
      return;
    }

    // -------------------------
    // students_auth 업데이트
    // (이름 없는 항목은 계정 삭제)
    // -------------------------
    for (const s of changed) {
      const student_id = toStudentId(s);

      // 이름이 없으면 계정 삭제
      if (!student_id) {
        await supabase
          .from("students_auth")
          .delete()
          .eq(
            "student_id",
            `${s.grade}${s.class}${String(s.number).padStart(
              2,
              "0"
            )}${originalStudents.find(
              (o) =>
                o.grade === s.grade && o.class === s.class && o.number === s.number
            )?.name}`
          );
        continue;
      }

      const { data: existing } = await supabase
        .from("students_auth")
        .select("*")
        .eq("student_id", student_id)
        .single();

      const tempPassword =
        existing?.temp_password || generateTempPassword();

      await supabase.from("students_auth").upsert(
        {
          student_id,
          username: student_id,
          temp_password: tempPassword,
          must_change_password: true,
        },
        { onConflict: ["student_id"] }
      );
    }

    toast.success(`변경된 ${changed.length}명 저장 완료`);
    setOriginalStudents(students);
    fetchStudents();
  };

  // -------------------------
  // 초기화 (students + students_auth)
  // -------------------------
  const handleReset = async () => {
    const resetStudents = students.map((s) => ({
      ...s,
      name: "",
      weekend: false,
      student_id: null,
    }));

    // students 초기화
    const { error: studentsErr } = await supabase
      .from("students")
      .upsert(resetStudents, { onConflict: ["grade", "class", "number"] });

    if (studentsErr) {
      toast.error("초기화 실패 (students)");
      return;
    }

    // students_auth 전체 삭제
    const { error: authErr } = await supabase
      .from("students_auth")
      .delete()
      .neq("student_id", "");

    if (authErr) {
      toast.error("초기화 실패 (auth)");
      return;
    }

    toast.success("전체 초기화 완료");
    fetchStudents();
  };

  const getStudentNumber = (g: number, c: number, n: number) =>
    g * 1000 + c * 100 + n;

  // -------------------------
  // UI
  // -------------------------
  return (
    <div className="p-4 space-y-8 overflow-x-auto">
      <Toaster position="top-right" />

      {grades.map((grade) => (
        <div key={grade}>
          <div className="flex items-center mb-4 gap-2">
            <h2 className="font-bold text-xl">{grade}학년</h2>
            <button
              onClick={handleSave}
              className="px-3 py-1 bg-gray-200 rounded-xl shadow-inner hover:shadow-md"
            >
              저장
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-1 bg-red-200 rounded-xl shadow-inner hover:shadow-md"
            >
              초기화
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            {classes.map((cls) => (
              <div
                key={cls}
                className="min-w-[200px] p-3 rounded-xl bg-gray-100 shadow-inner"
              >
                <h3 className="font-semibold mb-2">{cls}반</h3>

                <div className="flex flex-col gap-2">
                  {numbers.map((num) => {
                    const s = students.find(
                      (st) =>
                        st.grade === grade &&
                        st.class === cls &&
                        st.number === num
                    );

                    if (!s) return null;

                    return (
                      <div key={num} className="flex items-center gap-2">
                        <span className="w-12 text-right text-sm">
                          {getStudentNumber(grade, cls, num)}
                        </span>

                        <input
                          type="text"
                          value={s.name}
                          onChange={(e) =>
                            handleNameChange(grade, cls, num, e.target.value)
                          }
                          className="flex-1 max-w-[80px] px-2 py-1 rounded-lg border border-gray-300 text-sm shadow-inner"
                        />

                        <label className="flex items-center gap-1 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={s.weekend}
                            onChange={() =>
                              handleWeekendToggle(grade, cls, num)
                            }
                          />
                          매주
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
