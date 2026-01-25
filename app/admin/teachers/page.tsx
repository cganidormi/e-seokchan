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
  // UUID 생성 (브라우저 호환성용)
  // ----------------------------------------
  const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // ----------------------------------------
  // 새 교사 추가
  // ----------------------------------------
  const handleAddTeacher = () => {
    const newTeacher: Teacher = {
      id: generateUUID(), // 임시 ID (안전한 생성 함수 사용)
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

    const createdCredentials: string[] = [];

    for (const t of changed) {
      // teacher_id 생성 (이름 기반)
      const newTeacherId = generateTeacherID(t.name);

      // 이름이 없으면 스킵
      if (!newTeacherId) continue;

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

      // 1. 계정(teachers_auth) 생성/업데이트
      const { data: existing } = await supabase
        .from("teachers_auth")
        .select("*")
        .eq("teacher_id", newTeacherId)
        .single();

      const tempPassword = existing?.temp_password || generateTempPassword();

      const { error: authError } = await supabase.from("teachers_auth").upsert({
        teacher_id: newTeacherId,
        username: newTeacherId,
        temp_password: tempPassword,
        must_change_password: true,
      }, { onConflict: "teacher_id" });

      if (authError) {
        console.error("Auth creation failed:", authError);
        toast.error(`'${t.name}' 계정 생성 실패: ${authError.message}`);
        continue;
      }

      // 신규 계정이거나 비번이 변경된 경우 알림 목록에 추가
      if (!existing || existing.temp_password !== tempPassword) {
        createdCredentials.push(`${t.name} 선생님: ID=${newTeacherId}, PW=${tempPassword}`);
      }
      // 하지만 기존 계정이 있어도 관리자가 '저장'을 눌렀다는 건 신규 등록일 수도 있으니 안전하게 보여주는 게 좋음
      // 여기서는 '신규 생성'된 경우에만 보여주거나, 아니면 그냥 다 보여주는 게 나을 수도.
      // 일단 '신규 교사'인 경우에만 확실히 보여주자.
      const isNewTeacher = !originalTeachers.find(ot => ot.id === t.id);
      if (isNewTeacher) {
        // 중복 push 방지
        if (!createdCredentials.some(s => s.startsWith(`${t.name} 선생님`))) {
          createdCredentials.push(`${t.name} 선생님: ID=${newTeacherId}, PW=${tempPassword}`);
        }
      }

      // 2. teachers 테이블 업데이트/삽입
      if (isNewTeacher) {
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
        }
      } else {
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
        }
      }
    }

    toast.success(`작업 완료`);
    fetchTeachers();

    if (createdCredentials.length > 0) {
      alert(`[계정 생성 완료]\n\n다음 정보를 선생님들께 전달해주세요:\n\n${createdCredentials.join('\n\n')}`);
    }
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
    <div className="p-4 space-y-6 overflow-x-auto bg-white min-h-screen text-gray-900">
      <Toaster position="top-right" />

      {/* 상단 버튼 */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="font-bold text-xl text-gray-800 mr-auto">교사 관리</h2>

        <button
          onClick={handleAddTeacher}
          className="px-3 py-1.5 bg-blue-200 rounded-xl shadow-inner hover:shadow-md hover:bg-blue-100 transition text-sm font-medium"
        >
          + 교사 추가
        </button>

        <button
          onClick={handleSave}
          className="px-3 py-1.5 bg-gray-200 rounded-xl shadow-inner hover:shadow-md hover:bg-gray-100 transition text-sm font-medium"
        >
          저장
        </button>

        <button
          onClick={handleResetAll}
          className="px-3 py-1.5 bg-red-200 rounded-xl shadow-inner hover:shadow-md hover:bg-red-100 transition text-sm font-medium"
        >
          전체 초기화
        </button>
      </div>

      {/* 교사 목록 */}
      <div className="flex flex-col gap-3">
        {teachers.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
            <p className="font-medium text-lg">등록된 교사가 없습니다.</p>
            <p className="text-sm mt-2 text-gray-400">"+ 교사 추가" 버튼을 눌러 시작하세요.</p>
          </div>
        ) : (
          teachers.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 bg-white p-3 rounded-xl shadow-sm border border-gray-100 overflow-x-auto"
            >
              {/* 이름 */}
              <input
                type="text"
                value={t.name}
                placeholder="이름"
                onChange={(e) => handleFieldChange(t.id, "name", e.target.value)}
                className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-center bg-gray-50 focus:bg-white transition-colors"
                title={generateTeacherID(t.name) ? `ID: ${generateTeacherID(t.name)}` : 'ID 생성 예정'}
              />

              {/* 직책 */}
              <input
                type="text"
                value={t.position}
                placeholder="직책"
                onChange={(e) => handleFieldChange(t.id, "position", e.target.value)}
                className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-center bg-gray-50 focus:bg-white transition-colors"
              />

              {/* 승인권한 */}
              <label className="flex items-center justify-center cursor-pointer px-2 py-1.5 rounded-lg hover:bg-gray-50 transition border border-transparent hover:border-gray-100">
                <input
                  type="checkbox"
                  checked={t.can_approve}
                  onChange={() => toggleApprove(t.id)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs text-gray-500 ml-1.5 whitespace-nowrap">승인권한</span>
              </label>

              <div className="flex-1"></div>

              <div className="flex items-center gap-1">
                {/* 비번 초기화 */}
                {originalTeachers.find(ot => ot.id === t.id) && t.teacher_id && (
                  <button
                    onClick={async () => {
                      if (!confirm(`'${t.name}' 선생님의 비밀번호를 초기화하시겠습니까?`)) return;
                      const newPw = generateTempPassword();
                      const { error } = await supabase.from('teachers_auth').update({
                        temp_password: newPw,
                        must_change_password: true
                      }).eq('teacher_id', t.teacher_id);

                      if (error) toast.error('초기화 실패');
                      else {
                        alert(`[비밀번호 초기화 완료]\n\n선생님: ${t.name}\n임시 비밀번호: ${newPw}\n\n이 정보를 선생님께 전달해주세요.`);
                      }
                    }}
                    className="px-2.5 py-1.5 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 border border-yellow-200 active:scale-95 transition text-xs font-bold whitespace-nowrap"
                    title="비밀번호 초기화"
                  >
                    비번초기화
                  </button>
                )}

                {/* 삭제 */}
                <button
                  onClick={() => handleDeleteTeacher(t.id)}
                  className="px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 border border-red-100 active:scale-95 transition text-xs font-bold whitespace-nowrap"
                  title="삭제"
                >
                  삭제
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
