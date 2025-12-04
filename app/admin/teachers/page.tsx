"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/supabaseClient";
import toast, { Toaster } from "react-hot-toast";

interface Teacher {
  id: number;
  name: string;
  position: string;
  can_approve: boolean;
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [originalTeachers, setOriginalTeachers] = useState<Teacher[]>([]);

  const numbers = Array.from({ length: 50 }, (_, i) => i + 1);

  useEffect(() => {
    fetchTeachers();
  }, []);

  // ------------------------------
  // 교사 데이터 fetch
  // ------------------------------
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

    const formatted: Teacher[] = [];
    numbers.forEach((num) => {
      const t = data?.find((d) => d.id === num);
      formatted.push({
        id: num,
        name: t?.name || "",
        position: t?.position || "",
        can_approve: t?.can_approve ?? true, // 기본값 true
      });
    });

    setTeachers(formatted);
    setOriginalTeachers(formatted);
  };

  // ------------------------------
  // 이름 변경
  // ------------------------------
  const handleNameChange = (id: number, value: string) => {
    setTeachers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name: value } : t))
    );
  };

  // ------------------------------
  // 직책 변경
  // ------------------------------
  const handlePositionChange = (id: number, value: string) => {
    setTeachers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, position: value } : t))
    );
  };

  // ------------------------------
  // 승인권한 토글
  // ------------------------------
  const handleCanApproveToggle = (id: number) => {
    setTeachers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, can_approve: !t.can_approve } : t))
    );
  };

  // ------------------------------
  // 엑셀 연속 붙여넣기 처리
  // ------------------------------
  const handleBulkPaste = (startId: number, field: "name" | "position", text: string) => {
    const lines = text.trim().split(/\r?\n/);
    setTeachers((prev) =>
      prev.map((t) => {
        if (t.id >= startId && t.id < startId + lines.length) {
          const offset = t.id - startId;
          return { ...t, [field]: lines[offset] };
        }
        return t;
      })
    );
  };

  // ------------------------------
  // 변경 감지 후 저장
  // ------------------------------
  const handleSave = async () => {
    const changed = teachers.filter((t, idx) => {
      const o = originalTeachers[idx];
      return t.name !== o.name || t.position !== o.position || t.can_approve !== o.can_approve;
    });

    if (changed.length === 0) {
      toast("변경된 내용이 없습니다.");
      return;
    }

    const { error } = await supabase.from("teachers").upsert(changed, {
      onConflict: ["id"],
    });

    if (error) {
      console.error(error);
      toast.error("저장 실패");
      return;
    }

    toast.success(`변경된 ${changed.length}명 저장 완료!`);
    setOriginalTeachers([...teachers]);
    fetchTeachers();
  };

  // ------------------------------
  // 초기화
  // ------------------------------
  const handleReset = async () => {
    const resetTeachers = teachers.map((t) => ({
      ...t,
      name: "",
      position: "",
      can_approve: true,
    }));
    setTeachers(resetTeachers);

    const { error } = await supabase.from("teachers").upsert(resetTeachers, {
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

  return (
    <div className="p-4 space-y-6 overflow-x-auto">
      <Toaster position="top-right" />

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

      <div className="flex flex-col gap-2 min-w-max">
        {teachers.map((t) => (
          <div key={t.id} className="flex items-center gap-2 flex-wrap bg-gray-100 p-2 rounded-lg shadow-inner">
            <span className="w-10 text-right text-sm text-gray-600">{t.id}</span>

            <input
              type="text"
              value={t.name}
              placeholder="이름"
              onChange={(e) => handleNameChange(t.id, e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                const text = e.clipboardData.getData("text/plain");
                handleBulkPaste(t.id, "name", text);
              }}
              className="w-20 px-2 py-1 rounded-lg border border-gray-300 shadow-inner text-sm focus:shadow-md focus:outline-none transition"
            />

            <input
              type="text"
              value={t.position}
              placeholder="직책"
              onChange={(e) => handlePositionChange(t.id, e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                const text = e.clipboardData.getData("text/plain");
                handleBulkPaste(t.id, "position", text);
              }}
              className="w-20 px-2 py-1 rounded-lg border border-gray-300 shadow-inner text-sm focus:shadow-md focus:outline-none transition"
            />

            <label className="flex items-center gap-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={t.can_approve}
                onChange={() => handleCanApproveToggle(t.id)}
                className="w-4 h-4 cursor-pointer"
              />
              <span className="text-sm">승인권한</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
