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
  student_id?: string | null;
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
      String.fromCharCode(97 + Math.floor(Math.random() * 26))
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
              student_id: found?.student_id || null,
            });
          })
        )
      );

      setStudents(fullList);
      setOriginalStudents(JSON.parse(JSON.stringify(fullList)));
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
  // 붙여넣기 (엑셀 등에서 여러 이름 복사 시)
  // -------------------------
  const handlePaste = (
    grade: number,
    cls: number,
    num: number,
    e: React.ClipboardEvent
  ) => {
    const pasteData = e.clipboardData.getData("text");
    const names = pasteData
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    if (names.length <= 1) return; // 한 명이면 기본 동작 유지

    e.preventDefault();

    setStudents((prev) => {
      // 현재 반의 현재 번호부터 시작하여 순차적으로 채움
      const startIndex = prev.findIndex(
        (s) => s.grade === grade && s.class === cls && s.number === num
      );
      if (startIndex === -1) return prev;

      const newStudents = [...prev];
      names.forEach((name, i) => {
        if (startIndex + i < newStudents.length) {
          newStudents[startIndex + i] = {
            ...newStudents[startIndex + i],
            name,
          };
        }
      });
      return newStudents;
    });
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
  // 저장 (특정 학년의 students + students_auth)
  // -------------------------
  const handleSave = async (targetGrade: number) => {
    const changed = students.filter((s, idx) => {
      // 해당 학년의 데이터만 필터링
      if (s.grade !== targetGrade) return false;
      const o = originalStudents.find(
        (os) => os.grade === s.grade && os.class === s.class && os.number === s.number
      );
      if (!o) return true; // 신규 데이터면 변경된 것으로 간주
      return s.name !== o.name || s.weekend !== o.weekend;
    });

    if (changed.length === 0) {
      toast(`${targetGrade}학년의 변경된 내용이 없습니다.`);
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
      .upsert(studentsUpserts, { onConflict: "grade,class,number" });

    if (studentsErr) {
      console.error(studentsErr);
      toast.error(`${targetGrade}학년 정보 저장 실패`);
      return;
    }

    // -------------------------
    // students_auth 업데이트
    // (이름이 변경된 경우 기존 계정 삭제 후 재생성)
    // -------------------------
    for (const s of changed) {
      const student_id = toStudentId(s);

      // 이전 학생 정보 찾기 (이전 ID 확인용)
      const oldStudent = originalStudents.find(
        (o) => o.grade === s.grade && o.class === s.class && o.number === s.number
      );
      const old_student_id = oldStudent?.student_id;

      // 1. 이름이 바뀌었거나 삭제된 경우 -> 기존 구형 아이디 삭제
      if (old_student_id && old_student_id !== student_id) {
        await supabase
          .from("students_auth")
          .delete()
          .eq("student_id", old_student_id);
      }

      // 2. 추가 클린업: 10101 같은 "숫자만 있는 구형 아이디" 강제 삭제
      // 학번(G+CC+NN) 형식 아이디가 존재할 경우 삭제하여 이중 계정 방지
      const legacy_id = `${s.grade}${String(s.class).padStart(2, "0")}${String(s.number).padStart(2, "0")}`;
      if (legacy_id !== student_id) {
        await supabase
          .from("students_auth")
          .delete()
          .eq("student_id", legacy_id);
      }

      // 3. 새 이름이 있으면 계정 생성/업데이트
      if (student_id) {
        const { data: existing } = await supabase
          .from("students_auth")
          .select("*")
          .eq("student_id", student_id)
          .single();

        const tempPassword = existing?.temp_password || generateTempPassword();

        await supabase.from("students_auth").upsert(
          {
            student_id,
            username: student_id,
            temp_password: tempPassword,
            must_change_password: true,
          },
          { onConflict: "student_id" }
        );
      }
    }

    toast.success(`${targetGrade}학년 변경된 ${changed.length}명 저장 완료`);
    // 깊은 복사로 원본 상태 업데이트
    setOriginalStudents(JSON.parse(JSON.stringify(students)));
    fetchStudents();
  };

  // -------------------------
  // 초기화 (특정 학년의 students + students_auth + 관련 데이터)
  // -------------------------
  const handleReset = async (grade: number) => {
    if (
      !confirm(
        `정말 ${grade}학년 데이터를 초기화하시겠습니까? 관련된 모든 이석 신청, 좌석 배정, 계정 정보가 삭제됩니다.`
      )
    ) {
      return;
    }

    const gradePrefix = `${grade}%`;

    // 1. 이석 신청 내역 삭제 (학번 prefix 기준)
    const { error: leaveErr } = await supabase
      .from("leave_requests")
      .delete()
      .like("student_id", gradePrefix);

    if (leaveErr) {
      console.error(leaveErr);
      toast.error(`${grade}학년 이석 신청 내역 초기화 실패: ` + leaveErr.message);
      return;
    }

    // 2. 좌석 배정 정보 삭제 (학번 prefix 기준)
    const { error: seatErr } = await supabase
      .from("seat_assignments")
      .delete()
      .like("student_id", gradePrefix);

    if (seatErr) {
      console.error(seatErr);
      toast.error(`${grade}학년 좌석 배정 정보 초기화 실패: ` + seatErr.message);
      return;
    }

    // 3. students_auth 삭제 (학번 prefix 기준)
    const { error: authErr } = await supabase
      .from("students_auth")
      .delete()
      .like("student_id", gradePrefix);

    if (authErr) {
      console.error(authErr);
      toast.error(`${grade}학년 계정 정보 초기화 실패: ` + authErr.message);
      return;
    }

    // 4. students 데이터 삭제 (해당 학년 전체)
    const { error: studentsErr } = await supabase
      .from("students")
      .delete()
      .eq("grade", grade);

    if (studentsErr) {
      console.error(studentsErr);
      toast.error(`${grade}학년 학생 정보 초기화 실패: ` + studentsErr.message);
      return;
    }

    toast.success(`${grade}학년 전체 초기화 완료`);
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
              onClick={() => handleSave(grade)}
              className="px-3 py-1 bg-gray-200 rounded-xl shadow-inner hover:shadow-md"
            >
              저장
            </button>
            <button
              onClick={() => handleReset(grade)}
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
                          onPaste={(e) => handlePaste(grade, cls, num, e)}
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
