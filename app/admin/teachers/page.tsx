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
      .order("name");

    if (error) {
      console.error(error);
      toast.error("교사 정보 불러오기 실패");
      return;
    }

    // 이름이 있는 교사만 표시 (빈 행 제외)
    const validTeachers = (data as Teacher[]).filter(t => t.name && t.name.trim().length > 0);
    setTeachers(validTeachers);
    setOriginalTeachers(JSON.parse(JSON.stringify(validTeachers)));
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

  // 랜덤 임시비번 생성 (4숫자 + 2영문)
  const generateTempPassword = () => {
    const num = Math.floor(1000 + Math.random() * 9000).toString();
    const letters = Array.from({ length: 2 }, () =>
      String.fromCharCode(97 + Math.floor(Math.random() * 26))
    ).join("");
    return num + letters;
  };

  // ----------------------------------------
  // 새 교사 추가
  // ----------------------------------------
  const handleAddTeacher = () => {
    const newTeacher: Teacher = {
      id: crypto.randomUUID(), // 임시 ID (저장 시 DB에서 자동 생성)
      teacher_id: null,
      name: "",
      position: "",
      can_approve: true,
    };
    setTeachers([...teachers, newTeacher]);
  };

  // ----------------------------------------
  // 교사 삭제
  // ----------------------------------------
  const handleDeleteTeacher = async (id: string) => {
    const teacher = teachers.find(t => t.id === id);
    if (!teacher) return;

    // 새로 추가된 교사 (아직 DB에 없음)
    const isNew = !originalTeachers.find(t => t.id === id);

    if (isNew) {
      // 로컬 상태에서만 제거
      setTeachers(teachers.filter(t => t.id !== id));
      toast.success("교사를 목록에서 제거했습니다.");
      return;
    }

    // DB에 있는 교사 삭제 확인
    if (!confirm(`${teacher.name || '이 교사'}를 삭제하시겠습니까? 관련된 모든 이석 신청 정보가 영향을 받을 수 있습니다.`)) {
      return;
    }

    // 1. teachers_auth 삭제
    if (teacher.teacher_id) {
      await supabase
        .from("teachers_auth")
        .delete()
        .eq("teacher_id", teacher.teacher_id);
    }

    // 2. teachers 삭제
    const { error } = await supabase
      .from("teachers")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      toast.error("삭제 실패");
      return;
    }

    toast.success("교사가 삭제되었습니다.");
    fetchTeachers();
  };

  // ----------------------------------------
  // 저장 버튼
  // ----------------------------------------
  const handleSave = async () => {
    // 이름이 비어있는 교사는 저장하지 않음
    const validTeachers = teachers.filter(t => t.name && t.name.trim().length > 0);

    if (validTeachers.length === 0) {
      toast("저장할 교사가 없습니다.");
      return;
    }

    const changed = validTeachers.filter((t) => {
      const o = originalTeachers.find(ot => ot.id === t.id);
      if (!o) return true; // 신규 교사
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
      // teacher_id 생성 (이름 기반)
      const newTeacherId = generateTeacherID(t.name);
      const oldTeacher = originalTeachers.find(ot => ot.id === t.id);
      const oldTeacherId = oldTeacher?.teacher_id;

      // 이름이 변경되어 teacher_id가 바뀐 경우 기존 계정 삭제
      if (oldTeacherId && oldTeacherId !== newTeacherId) {
        await supabase
          .from("teachers_auth")
          .delete()
          .eq("teacher_id", oldTeacherId);
      }

      // 새 teacher_id 설정
      t.teacher_id = newTeacherId;

      // 계정 생성/업데이트
      if (newTeacherId) {
        const { data: existing } = await supabase
          .from("teachers_auth")
          .select("*")
          .eq("teacher_id", newTeacherId)
          .single();

        const tempPassword = existing?.temp_password || generateTempPassword();

        await supabase.from("teachers_auth").upsert({
          teacher_id: newTeacherId,
          username: newTeacherId,
          temp_password: tempPassword,
          must_change_password: true,
        }, { onConflict: "teacher_id" });
      }
    }

    // teachers 테이블 업데이트/삽입
    for (const t of changed) {
      const isNewTeacher = !originalTeachers.find(ot => ot.id === t.id);

      if (isNewTeacher) {
        // 신규 교사 추가
        const { error } = await supabase
          .from("teachers")
          .insert({
            teacher_id: t.teacher_id,
            name: t.name,
            position: t.position,
            can_approve: t.can_approve,
          });

        if (error) {
          console.error(error);
          toast.error(`저장 실패: ${t.name}`);
          return;
        }
      } else {
        // 기존 교사 업데이트
        const { error } = await supabase
          .from("teachers")
          .update({
            teacher_id: t.teacher_id,
            name: t.name,
            position: t.position,
            can_approve: t.can_approve,
          })
          .eq("id", t.id);

        if (error) {
          console.error(error);
          toast.error(`저장 실패: ${t.name}`);
          return;
        }
      }
    }

    toast.success(`${changed.length}명 저장 완료!`);
    fetchTeachers();
  };

  // ----------------------------------------
  // 전체 초기화 버튼
  // ----------------------------------------
  const handleResetAll = async () => {
    if (!confirm("정말 모든 교사 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
      return;
    }

    // 1. 모든 teachers_auth 삭제
    const { error: authErr } = await supabase
      .from("teachers_auth")
      .delete()
      .gt("teacher_id", "");

    if (authErr) {
      console.error(authErr);
      toast.error("계정 정보 삭제 실패");
      return;
    }

    // 2. 모든 teachers 삭제
    const { error: teachersErr } = await supabase
      .from("teachers")
      .delete()
      .not("id", "is", null);

    if (teachersErr) {
      console.error(teachersErr);
      toast.error("교사 정보 삭제 실패");
      return;
    }

    toast.success("전체 초기화 완료!");
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
          onClick={handleAddTeacher}
          className="px-3 py-1 bg-blue-200 rounded-xl shadow-inner hover:shadow-md hover:bg-blue-100 transition text-sm"
        >
          + 교사 추가
        </button>

        <button
          onClick={handleSave}
          className="px-3 py-1 bg-gray-200 rounded-xl shadow-inner hover:shadow-md hover:bg-gray-100 transition text-sm"
        >
          저장
        </button>

        <button
          onClick={handleResetAll}
          className="px-3 py-1 bg-red-200 rounded-xl shadow-inner hover:shadow-md hover:bg-red-100 transition text-sm"
        >
          전체 초기화
        </button>
      </div>

      {/* 교사 목록 */}
      <div className="flex flex-col gap-2 min-w-max">
        {teachers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>등록된 교사가 없습니다.</p>
            <p className="text-sm mt-2">"+ 교사 추가" 버튼을 눌러 교사를 추가하세요.</p>
          </div>
        ) : (
          teachers.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 bg-gray-100 p-2 rounded-lg shadow-inner"
            >
              {/* 이름 */}
              <input
                type="text"
                value={t.name}
                placeholder="이름"
                onChange={(e) =>
                  handleFieldChange(t.id, "name", e.target.value)
                }
                className="w-32 px-2 py-1 rounded-lg border border-gray-300 shadow-inner text-sm"
              />

              {/* 직책 */}
              <input
                type="text"
                value={t.position}
                placeholder="직책"
                onChange={(e) =>
                  handleFieldChange(t.id, "position", e.target.value)
                }
                className="w-32 px-2 py-1 rounded-lg border border-gray-300 shadow-inner text-sm"
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
              <span className="text-xs text-green-700 flex-1">
                {t.teacher_id ? `ID: ${t.teacher_id}` : ""}
              </span>

              {/* 삭제 버튼 */}
              <button
                onClick={() => handleDeleteTeacher(t.id)}
                className="px-2 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-sm"
              >
                삭제
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
