"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/supabaseClient";
import toast, { Toaster } from "react-hot-toast";

interface Teacher {
  id: string;                // uuid PK
  teacher_id: string | null; // login id
  name: string;
  position: string;
  can_approve: boolean;
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [originalTeachers, setOriginalTeachers] = useState<Teacher[]>([]);

  useEffect(() => {
    fetchTeachers();
  }, []);

  // ----------------------------------------
  // 교사 목록 불러오기
  // ----------------------------------------
  const fetchTeachers = async () => {
    const { data, error } = await supabase
      .from("teachers")
      .select("*")
      .order("id");

    if (error) {
      console.error(error);
      toast.error("교사 정보 불러오기 실패");
      return;
    }

    setTeachers(data as Teacher[]);
    setOriginalTeachers(JSON.parse(JSON.stringify(data)));
  };

  // ----------------------------------------
  // 이름/직책/권한 변경 핸들러
  // ----------------------------------------
  const handleFieldChange = (id: string, field: string, value: any) => {
    setTeachers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const toggleApprove = (id: string) => {
    setTeachers((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, can_approve: !t.can_approve } : t
      )
    );
  };

  // ----------------------------------------
  // teacher_id 자동 생성
  // ----------------------------------------
  const generateTeacherID = (name: string) => {
    if (!name) return null;
    return name.trim().replace(/\s+/g, "");
  };

  // 랜덤 임시비번 생성
  const generateTempPassword = () => {
    return Math.random().toString(36).slice(2, 8);
  };

  // ----------------------------------------
  // 저장 버튼
  // ----------------------------------------
  const handleSave = async () => {
    const changed = teachers.filter((t, i) => {
      const o = originalTeachers[i];
      return (
        t.name !== o.name ||
        t.position !== o.position ||
        t.can_approve !== o.can_approve
      );
    });

    if (changed.length === 0) {
      toast("변경된 내용이 없습니다.");
      return;
    }

    for (const t of changed) {
      // 신규 ID 필요하면 생성
      if (t.name && !t.teacher_id) {
        t.teacher_id = generateTeacherID(t.name);

        const tempPw = generateTempPassword();

        await supabase.from("teachers_auth").upsert({
          teacher_id: t.teacher_id,
          username: t.teacher_id,
          temp_password: tempPw,
          must_change_password: true,
        });
      }
    }

    // teachers 테이블 업데이트
    const { error } = await supabase.from("teachers").upsert(changed, {
      onConflict: ["id"],
    });

    if (error) {
      console.error(error);
      toast.error("저장 실패");
      return;
    }

    toast.success(`변경된 ${changed.length}명 저장 완료!`);
    fetchTeachers();
  };

  // ----------------------------------------
  // 초기화 버튼
  // ----------------------------------------
  const handleReset = async () => {
    // auth 초기화 (모두 삭제)
    await supabase.from("teachers_auth").delete().neq("teacher_id", "");

    // teachers 초기화
    const reset = teachers.map((t) => ({
      id: t.id,
      teacher_id: null,
      name: "",
      position: "",
      can_approve: true,
    }));

    const { error } = await supabase.from("teachers").upsert(reset, {
      onConflict: ["id"],
    });

    if (error) {
      console.error(error);
      toast.error("초기화 실패");
      return;
    }

    toast.success("초기화 완료!");
    fetchTeachers();
  };

  // ----------------------------------------
  // UI
  // ----------------------------------------
  return (
    <div className="p-4 space-y-6 overflow-x-auto">
      <Toaster position="top-right" />

      {/* 상단 버튼 */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="font-bold text-xl text-gray-800">교사 관리</h2>

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

      {/* 리스트 */}
      <div className="flex flex-col gap-2 min-w-max">
        {teachers.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 bg-gray-100 p-2 rounded-lg shadow-inner"
          >
            {/* UUID 앞부분 표시 */}
            <span className="w-16 text-xs text-gray-600">
              {t.id.slice(0, 6)}
            </span>

            {/* 이름 */}
            <input
              type="text"
              value={t.name}
              placeholder="이름"
              onChange={(e) =>
                handleFieldChange(t.id, "name", e.target.value)
              }
              className="w-24 px-2 py-1 rounded-lg border border-gray-300 shadow-inner text-sm"
            />

            {/* 직책 */}
            <input
              type="text"
              value={t.position}
              placeholder="직책"
              onChange={(e) =>
                handleFieldChange(t.id, "position", e.target.value)
              }
              className="w-24 px-2 py-1 rounded-lg border border-gray-300 shadow-inner text-sm"
            />

            {/* 승인권한 */}
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={t.can_approve}
                onChange={() => toggleApprove(t.id)}
                className="w-4 h-4"
              />
              <span className="text-sm">승인권한</span>
            </label>

            {/* 생성된 ID 표시 */}
            <span className="text-xs text-green-700">
              {t.teacher_id ? `ID: ${t.teacher_id}` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
