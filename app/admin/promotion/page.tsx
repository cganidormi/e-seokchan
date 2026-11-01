"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/supabaseClient";
import toast, { Toaster } from "react-hot-toast";
import { getAdminHeaders } from "@/lib/adminClientHeaders";
import Link from "next/link";
import { HiHome } from "react-icons/hi";

interface ExistingStudent {
  grade: number;
  class: number;
  number: number;
  name: string;
  weekend: boolean;
  student_id: string;
  parent_token?: string | null;
}

interface PromotionSlot {
  grade: number;
  class: number;
  number: number;
  name: string;
  weekend: boolean;
  /** 동명이인이 있을 때 교사가 수동으로 지정한 기존 student_id */
  selectedOldStudentId?: string | null;
}

export default function PromotionPage() {
  const grades = [1, 2, 3];
  const classes = [1, 2, 3];
  const numbers = Array.from({ length: 22 }, (_, i) => i + 1);

  // 현재 DB에 저장된 재학생 목록 (읽기 전용 원본)
  const [existingStudents, setExistingStudents] = useState<ExistingStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 새학기 명렬표 입력 슬롯 (학생관리 페이지와 동일한 1~3학년, 1~3반, 1~22번 구조)
  const [slots, setSlots] = useState<PromotionSlot[]>(() => {
    const init: PromotionSlot[] = [];
    [1, 2, 3].forEach((g) =>
      [1, 2, 3].forEach((c) =>
        Array.from({ length: 22 }, (_, i) => i + 1).forEach((n) => {
          init.push({
            grade: g,
            class: c,
            number: n,
            name: "",
            weekend: false,
            selectedOldStudentId: null,
          });
        })
      )
    );
    return init;
  });

  // 실행 옵션 및 시뮬레이션 결과 모달 상태
  const [isRealModeUnlocked, setIsRealModeUnlocked] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [resetSeats, setResetSeats] = useState(true);
  const [resetRooms, setResetRooms] = useState(true);
  const [resetLeaves, setResetLeaves] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);

  useEffect(() => {
    fetchExistingStudents();
  }, []);

  const fetchExistingStudents = async () => {
    setIsLoading(true);
    const role =
      typeof window !== "undefined"
        ? localStorage.getItem("dormichan_role") ||
        sessionStorage.getItem("dormichan_role")
        : null;
    if (role !== "teacher") {
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("students")
      .select("*")
      .order("grade")
      .order("class")
      .order("number");

    if (error) {
      toast.error("기존 학생 데이터를 불러오지 못했습니다.");
      setIsLoading(false);
      return;
    }

    const valid = (data || []).filter(
      (s: any) => s.name && s.name.trim().length > 0 && s.student_id
    ) as ExistingStudent[];
    setExistingStudents(valid);
    setIsLoading(false);
  };

  // 학년별 기존 학생 분류
  const existingByGrade = useMemo(() => {
    return {
      1: existingStudents.filter((s) => s.grade === 1),
      2: existingStudents.filter((s) => s.grade === 2),
      3: existingStudents.filter((s) => s.grade === 3),
    };
  }, [existingStudents]);

  // 각 슬롯에 대해 기존 재학생(2학년 슬롯 -> 구 1학년, 3학년 슬롯 -> 구 2학년) 자동 매칭 계산
  const slotMatchInfo = useMemo(() => {
    const map = new Map<
      string,
      {
        status: "empty" | "freshman" | "matched" | "duplicate" | "new_transfer";
        candidates: ExistingStudent[];
        matchedStudent: ExistingStudent | null;
      }
    >();

    slots.forEach((slot) => {
      const key = `${slot.grade}-${slot.class}-${slot.number}`;
      const cleanName = slot.name.trim();

      if (!cleanName) {
        map.set(key, { status: "empty", candidates: [], matchedStudent: null });
        return;
      }

      // 1학년은 전원 신입생
      if (slot.grade === 1) {
        map.set(key, {
          status: "freshman",
          candidates: [],
          matchedStudent: null,
        });
        return;
      }

      // 2학년은 기존 1학년에서, 3학년은 기존 2학년에서 이름 검색
      const sourcePool =
        slot.grade === 2 ? existingByGrade[1] : existingByGrade[2];
      const candidates = sourcePool.filter((s) => s.name.trim() === cleanName);

      if (candidates.length === 0) {
        map.set(key, {
          status: "new_transfer",
          candidates: [],
          matchedStudent: null,
        });
      } else if (candidates.length === 1) {
        map.set(key, {
          status: "matched",
          candidates,
          matchedStudent: candidates[0],
        });
      } else {
        // 동명이인이 2명 이상인 경우
        const chosen =
          candidates.find((c) => c.student_id === slot.selectedOldStudentId) ||
          null;
        map.set(key, {
          status: "duplicate",
          candidates,
          matchedStudent: chosen,
        });
      }
    });

    return map;
  }, [slots, existingByGrade]);

  // 매칭 통계 및 누락된 기존 재학생(전출/미입력 확인용) 계산
  const stats = useMemo(() => {
    let freshmanCount = 0;
    let promoted1To2 = 0;
    let promoted2To3 = 0;
    let transferCount = 0;
    let unresolvedDuplicates = 0;
    const matchedOldIds = new Set<string>();

    slots.forEach((slot) => {
      const key = `${slot.grade}-${slot.class}-${slot.number}`;
      const info = slotMatchInfo.get(key);
      if (!info || info.status === "empty") return;

      if (info.status === "freshman") {
        freshmanCount++;
      } else if (info.status === "new_transfer") {
        transferCount++;
      } else if (info.status === "matched" && info.matchedStudent) {
        matchedOldIds.add(info.matchedStudent.student_id);
        if (slot.grade === 2) promoted1To2++;
        if (slot.grade === 3) promoted2To3++;
      } else if (info.status === "duplicate") {
        if (info.matchedStudent) {
          matchedOldIds.add(info.matchedStudent.student_id);
          if (slot.grade === 2) promoted1To2++;
          if (slot.grade === 3) promoted2To3++;
        } else {
          unresolvedDuplicates++;
        }
      }
    });

    const unmatchedGrade1 = existingByGrade[1].filter(
      (s) => !matchedOldIds.has(s.student_id)
    );
    const unmatchedGrade2 = existingByGrade[2].filter(
      (s) => !matchedOldIds.has(s.student_id)
    );

    return {
      graduatingGrade3Count: existingByGrade[3].length,
      freshmanCount,
      promoted1To2,
      promoted2To3,
      transferCount,
      unresolvedDuplicates,
      unmatchedGrade1,
      unmatchedGrade2,
    };
  }, [slots, slotMatchInfo, existingByGrade]);

  const getStudentNumber = (g: number, c: number, n: number) =>
    g * 1000 + c * 100 + n;

  // 이름 입력 시 학번이 앞에 붙어있으면(예: "2101 홍길동" 또는 "2101홍길동") 자동으로 이름만 추출
  const sanitizePastedName = (raw: string) => {
    return raw.replace(/^\d{3,4}[\s\t-]*/, "").trim();
  };

  // 단일 칸 이름 변경
  const handleNameChange = (
    grade: number,
    cls: number,
    num: number,
    value: string
  ) => {
    const cleaned = sanitizePastedName(value);
    setSlots((prev) =>
      prev.map((s) => {
        if (s.grade === grade && s.class === cls && s.number === num) {
          // 기존 학생 중 동일 이름이 있으면 주말귀가 설정도 기본 승계
          const pool =
            grade === 2
              ? existingByGrade[1]
              : grade === 3
                ? existingByGrade[2]
                : [];
          const matched = pool.find((m) => m.name.trim() === cleaned);
          return {
            ...s,
            name: cleaned,
            weekend: matched ? matched.weekend : s.weekend,
            selectedOldStudentId: null,
          };
        }
        return s;
      })
    );
  };

  // 엑셀 명렬표 복사 붙여넣기 (학생관리 페이지와 동일한 방식 + 학번 자동제거 지원)
  const handlePaste = (
    grade: number,
    cls: number,
    num: number,
    e: React.ClipboardEvent
  ) => {
    const pasteData = e.clipboardData.getData("text");
    const names = pasteData
      .split(/\r?\n/)
      .map((line) => sanitizePastedName(line))
      .filter((name) => name.length > 0);

    if (names.length <= 1) return;

    e.preventDefault();

    const pool =
      grade === 2
        ? existingByGrade[1]
        : grade === 3
          ? existingByGrade[2]
          : [];

    setSlots((prev) => {
      const startIndex = prev.findIndex(
        (s) => s.grade === grade && s.class === cls && s.number === num
      );
      if (startIndex === -1) return prev;

      const next = [...prev];
      names.forEach((name, i) => {
        const targetIdx = startIndex + i;
        // 같은 학년 내에서만 순차적으로 채움
        if (targetIdx < next.length && next[targetIdx].grade === grade) {
          const matched = pool.find((m) => m.name.trim() === name);
          next[targetIdx] = {
            ...next[targetIdx],
            name,
            weekend: matched ? matched.weekend : next[targetIdx].weekend,
            selectedOldStudentId: null,
          };
        }
      });
      return next;
    });
  };

  // 동명이인 수동 선택
  const handleSelectDuplicate = (
    grade: number,
    cls: number,
    num: number,
    oldStudentId: string
  ) => {
    const pool = grade === 2 ? existingByGrade[1] : existingByGrade[2];
    const chosen = pool.find((m) => m.student_id === oldStudentId);
    setSlots((prev) =>
      prev.map((s) =>
        s.grade === grade && s.class === cls && s.number === num
          ? {
            ...s,
            selectedOldStudentId: oldStudentId || null,
            weekend: chosen ? chosen.weekend : s.weekend,
          }
          : s
      )
    );
  };

  // 매주귀가 토글
  const handleWeekendToggle = (grade: number, cls: number, num: number) => {
    setSlots((prev) =>
      prev.map((s) =>
        s.grade === grade && s.class === cls && s.number === num
          ? { ...s, weekend: !s.weekend }
          : s
      )
    );
  };

  // 특정 학년 입력칸 비우기
  const handleClearGrade = (targetGrade: number) => {
    setSlots((prev) =>
      prev.map((s) =>
        s.grade === targetGrade
          ? { ...s, name: "", weekend: false, selectedOldStudentId: null }
          : s
      )
    );
    toast.success(`${targetGrade}학년 새학기 입력란을 비웠습니다.`);
  };

  // [테스트 편의 기능] 현재 1->2학년, 2->3학년 가상 진급 명단 자동 채우기
  const handleFillTestSample = () => {
    setSlots((prev) => {
      const next = prev.map((s) => ({
        ...s,
        name: "",
        weekend: false,
        selectedOldStudentId: null,
      }));

      // 기존 2학년 -> 새 3학년 (반별로 1번부터 빈칸 없이 순차 배정하여 번호 당겨짐 테스트)
      [1, 2, 3].forEach((cls) => {
        const classStudents = existingByGrade[2].filter((stu) => stu.class === cls);
        classStudents.forEach((stu, i) => {
          const newNum = i + 1;
          const idx = next.findIndex(
            (s) => s.grade === 3 && s.class === cls && s.number === newNum
          );
          if (idx !== -1) {
            next[idx] = {
              ...next[idx],
              name: stu.name,
              weekend: stu.weekend,
            };
          }
        });
      });

      // 기존 1학년 -> 새 2학년 (반별로 1번부터 빈칸 없이 순차 배정하여 번호 당겨짐 테스트)
      [1, 2, 3].forEach((cls) => {
        const classStudents = existingByGrade[1].filter((stu) => stu.class === cls);
        classStudents.forEach((stu, i) => {
          const newNum = i + 1;
          const idx = next.findIndex(
            (s) => s.grade === 2 && s.class === cls && s.number === newNum
          );
          if (idx !== -1) {
            next[idx] = {
              ...next[idx],
              name: stu.name,
              weekend: stu.weekend,
            };
          }
        });
      });

      // 1학년 1반 1~3번에 가상 신입생 샘플 입력
      const sampleFreshmen = ["김신입", "이새싹", "박희망"];
      sampleFreshmen.forEach((nm, i) => {
        const idx = next.findIndex(
          (s) => s.grade === 1 && s.class === 1 && s.number === i + 1
        );
        if (idx !== -1) {
          next[idx] = { ...next[idx], name: nm, weekend: false };
        }
      });

      return next;
    });

    toast.success(
      "현재 1·2학년 재학생을 새학기 2·3학년 칸으로 자동 배치했습니다! (모의 테스트용)"
    );
  };

  // 시뮬레이션 또는 실제 진급 실행
  const handleRunPromotion = async (dryRun: boolean) => {
    const filledSlots = slots.filter((s) => s.name.trim().length > 0);
    if (filledSlots.length === 0) {
      toast.error("새학기 명렬표에 입력된 학생 이름이 없습니다.");
      return;
    }

    if (stats.unresolvedDuplicates > 0) {
      toast.error(
        `동명이인 선택이 완료되지 않은 학생이 ${stats.unresolvedDuplicates}명 있습니다. 노란색 선택창에서 작년 학번을 지정해 주세요.`
      );
      return;
    }

    if (!dryRun) {
      if (confirmText !== "새학기진급실행") {
        toast.error('안전 확인 문구("새학기진급실행")를 정확히 입력해 주세요.');
        return;
      }
      if (
        !confirm(
          "정말 실제 데이터베이스에 새학기 진급 및 졸업 처리를 반영하시겠습니까?\n3학년은 졸업(삭제)되며, 1·2학년은 새 학번으로 진급합니다."
        )
      ) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const entries = filledSlots.map((slot) => {
        const key = `${slot.grade}-${slot.class}-${slot.number}`;
        const info = slotMatchInfo.get(key);
        return {
          newGrade: slot.grade,
          newClass: slot.class,
          newNumber: slot.number,
          name: slot.name.trim(),
          weekend: slot.weekend,
          matchedOldStudentId: info?.matchedStudent?.student_id || null,
        };
      });

      const resp = await fetch("/api/admin/promote-students", {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({
          dryRun,
          confirmText,
          entries,
          options: {
            resetSeats,
            resetRooms,
            resetLeaves,
          },
        }),
      });

      const result = await resp.json();
      if (!resp.ok || !result.success) {
        throw new Error(result.error || "처리 중 오류가 발생했습니다.");
      }

      setSimulationResult(result);
      setIsResultModalOpen(true);

      if (dryRun) {
        toast.success(
          "시뮬레이션 완료! (실제 DB는 전혀 변경되지 않았습니다)"
        );
      } else {
        toast.success("새학기 진급 및 신입생 등록이 실제 DB에 반영되었습니다!");
        setIsRealModeUnlocked(false);
        setConfirmText("");
        fetchExistingStudents();
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "진급 처리 요청 실패");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 시뮬레이션/실행 결과 CSV 다운로드 (신입생 + 진급생 전체 또는 학년별)
  const handleDownloadResultCsv = (targetGrade?: number) => {
    if (!simulationResult?.summary) return;
    const { promotedPreview = [], newCreatedPreview = [] } =
      simulationResult.summary;

    const csvRows = [
      [
        "구분",
        "새학년",
        "새반",
        "새번호",
        "이름",
        "새아이디(학번)",
        "이전학번",
        "학생고유비번(토큰)",
        "학부모토큰",
      ],
    ];

    const allRows = [
      ...newCreatedPreview.map((n: any) => ({
        type: n.grade === 1 ? "신입생" : "전입/신규",
        grade: n.grade,
        class: n.class,
        number: n.number,
        name: n.name,
        student_id: n.student_id,
        old_student_id: "-",
        pw: n.temp_password || "",
        token: n.parent_token,
      })),
      ...promotedPreview.map((p: any) => ({
        type: "진급생",
        grade: p.grade,
        class: p.class,
        number: p.number,
        name: p.name,
        student_id: p.student_id,
        old_student_id: p.old_student_id,
        pw: p.temp_password || p.password_status,
        token: p.parent_token,
      })),
    ].sort(
      (a, b) =>
        a.grade - b.grade || a.class - b.class || a.number - b.number
    );

    allRows
      .filter((r) => !targetGrade || r.grade === targetGrade)
      .forEach((r) => {
        csvRows.push([
          r.type,
          String(r.grade),
          String(r.class),
          String(r.number),
          r.name,
          r.student_id,
          r.old_student_id,
          r.pw,
          r.token || "",
        ]);
      });

    const csvContent = "\uFEFF" + csvRows.map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const prefix = targetGrade ? `${targetGrade}학년_` : "전교생_";
    const modeTag = simulationResult.mode === "simulation" ? "모의테스트_" : "";
    link.setAttribute(
      "download",
      `${modeTag}새학기_${prefix}계정정보_${new Date().toLocaleDateString()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 space-y-6 overflow-x-auto bg-white min-h-screen text-gray-900">
      <Toaster position="top-right" />

      {/* 상단 타이틀 및 우측 홈버튼 */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-gray-900">
              새학기 진급 관리
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-extrabold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              🧪 학기 중 안전 테스트 지원
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            기존 학생관리 페이지와 동일하게 새학기 명렬표 이름을 복사·붙여넣기 하면,{" "}
            <strong className="text-gray-800">
              3학년은 졸업, 1·2학년 재학생은 기존 비밀번호·학부모토큰을 유지한 채 진급, 1학년 신입생만 신규 생성
            </strong>
            합니다.
          </p>
        </div>

        <Link
          href="/teacher"
          className="h-10 w-10 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 shadow-sm transition-all flex items-center justify-center cursor-pointer shrink-0 active:scale-95"
          title="교사 홈으로 이동"
        >
          <HiHome className="w-5 h-5 text-gray-700" />
        </Link>
      </div>

      {/* 상단 요약 & 컨트롤 배너 */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* 실시간 매칭 현황 카운터 */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="px-3 py-1.5 rounded-xl bg-rose-100 text-rose-800 border border-rose-200">
              🎓 현 3학년 졸업 예정: {stats.graduatingGrade3Count}명
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200">
              📈 2→3학년 진급 매칭: {stats.promoted2To3} / {existingByGrade[2].length}명
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-teal-100 text-teal-800 border border-teal-200">
              📈 1→2학년 진급 매칭: {stats.promoted1To2} / {existingByGrade[1].length}명
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-blue-100 text-blue-800 border border-blue-200">
              🌱 1학년 신입생: {stats.freshmanCount}명
            </span>
            {stats.transferCount > 0 && (
              <span className="px-3 py-1.5 rounded-xl bg-indigo-100 text-indigo-800 border border-indigo-200">
                🆕 2·3학년 전입/신규: {stats.transferCount}명
              </span>
            )}
            {stats.unresolvedDuplicates > 0 && (
              <span className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                ⚠️ 동명이인 선택 필요: {stats.unresolvedDuplicates}명
              </span>
            )}
          </div>

          {/* 우측 빠른 액션 버튼들 */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleFillTestSample}
              className="px-3 py-2 rounded-xl bg-violet-100 hover:bg-violet-200 text-violet-900 font-extrabold text-xs border border-violet-300 transition-all cursor-pointer active:scale-95"
            >
              ⚡ 현재 재학생으로 모의 진급 자동 채우기
            </button>

            <button
              type="button"
              onClick={() => handleRunPromotion(true)}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs sm:text-sm shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              🧪 진급 시뮬레이션 결과 보기 (DB 변경 없음)
            </button>
          </div>
        </div>

        {/* 아직 새학기 명렬표에 매칭되지 않은 기존 1·2학년 안내 (누락/전출 확인용) */}
        {(stats.promoted1To2 > 0 || stats.promoted2To3 > 0) &&
          (stats.unmatchedGrade1.length > 0 ||
            stats.unmatchedGrade2.length > 0) && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="font-extrabold">
                🔍 새학기 명렬표에 아직 입력되지 않은 기존 재학생 (오타 누락 또는 전출생 확인)
              </div>
              {stats.unmatchedGrade2.length > 0 && (
                <div>
                  <span className="font-bold">
                    • 현 2학년 미매칭 ({stats.unmatchedGrade2.length}명):{" "}
                  </span>
                  {stats.unmatchedGrade2
                    .map((s) => `${s.student_id}`)
                    .join(", ")}
                </div>
              )}
              {stats.unmatchedGrade1.length > 0 && (
                <div>
                  <span className="font-bold">
                    • 현 1학년 미매칭 ({stats.unmatchedGrade1.length}명):{" "}
                  </span>
                  {stats.unmatchedGrade1
                    .map((s) => `${s.student_id}`)
                    .join(", ")}
                </div>
              )}
            </div>
          )}

        {/* 실제 새학기 DB 반영 잠금 영역 (평소 학기 중 실수 완벽 차단) */}
        <div className="pt-2 border-t border-slate-200 flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isRealModeUnlocked}
                onChange={(e) => {
                  if (e.target.checked) {
                    const ok = confirm(
                      "정말로 '실제 새학기 DB 반영 모드' 잠금을 해제하시겠습니까?\n\n⚠️ 현재 학기 중(모의 테스트)이라면 절대 해제하지 마시고 '취소'를 눌러주세요.\n(실제 새학기 시작일에만 잠금을 해제해야 합니다.)"
                    );
                    if (!ok) return;
                  } else {
                    setConfirmText("");
                  }
                  setIsRealModeUnlocked(e.target.checked);
                }}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span>
                🔒 실제 새학기 DB 반영 모드 잠금 해제 (새학기 시작 시에만 체크하세요)
              </span>
            </label>
          </div>

          {isRealModeUnlocked && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex flex-col gap-3">
              <div className="text-xs font-bold text-red-800">
                ⚠️ 주의: 실제 반영을 실행하면 현재 3학년은 졸업(삭제) 처리되고, 1·2학년이 새 학번으로 실제 진급합니다.
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-800">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={resetSeats}
                    onChange={(e) => setResetSeats(e.target.checked)}
                  />
                  <span>기존 자습실 좌석 배정 초기화</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={resetRooms}
                    onChange={(e) => setResetRooms(e.target.checked)}
                  />
                  <span>기존 기숙사 호실 배정 초기화</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={resetLeaves}
                    onChange={(e) => setResetLeaves(e.target.checked)}
                  />
                  <span>지난 학기 이석 신청 기록 전체 초기화</span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder='"새학기진급실행" 입력'
                  className="px-3 py-1.5 rounded-lg border border-red-300 bg-white text-xs font-bold text-gray-900 w-44"
                />
                <button
                  type="button"
                  onClick={() => handleRunPromotion(false)}
                  disabled={isSubmitting || confirmText !== "새학기진급실행"}
                  className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-40"
                >
                  🚀 실제 새학기 진급 DB 반영 실행
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 학년별 명렬표 입력 영역 (학생관리 페이지와 동일한 레이아웃) */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-gray-500 font-bold">
          현재 재학생 데이터를 불러오는 중...
        </div>
      ) : (
        grades.map((grade) => {
          const gradeRoleDesc =
            grade === 1
              ? "🌱 신입생 명렬표 붙여넣기 (학생 고유 비번 + 학부모 고유 토큰 신규 생성)"
              : grade === 2
                ? "📈 새학기 2학년 명렬표 붙여넣기 (현 1학년과 이름 자동 매칭 → 고유비번·학부모토큰 유지)"
                : "📈 새학기 3학년 명렬표 붙여넣기 (현 2학년과 이름 자동 매칭 → 고유비번·학부모토큰 유지)";

          return (
            <div key={grade} className="space-y-3">
              <div className="flex flex-wrap items-center mb-2 gap-2">
                <h2 className="font-bold text-xl text-gray-900">
                  새학기 {grade}학년
                </h2>
                <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">
                  {gradeRoleDesc}
                </span>
                <button
                  type="button"
                  onClick={() => handleClearGrade(grade)}
                  className="px-3 py-1 bg-red-100 text-red-800 rounded-xl shadow-inner hover:shadow-md text-xs font-bold whitespace-nowrap cursor-pointer"
                >
                  {grade}학년 입력 비우기
                </button>
              </div>

              <div className="flex flex-wrap gap-3">
                {classes.map((cls) => (
                  <div
                    key={cls}
                    className="min-w-[220px] p-3 rounded-xl bg-gray-100 shadow-inner"
                  >
                    <h3 className="font-semibold mb-2 text-gray-900">
                      {cls}반
                    </h3>

                    <div className="flex flex-col gap-2">
                      {numbers.map((num) => {
                        const s = slots.find(
                          (st) =>
                            st.grade === grade &&
                            st.class === cls &&
                            st.number === num
                        );
                        if (!s) return null;

                        const key = `${grade}-${cls}-${num}`;
                        const matchInfo = slotMatchInfo.get(key);

                        return (
                          <div key={num} className="flex items-center gap-1.5">
                            {/* 학번 (1101 ~ 3322) */}
                            <span className="w-11 text-right text-sm text-gray-900 font-medium shrink-0">
                              {getStudentNumber(grade, cls, num)}
                            </span>

                            {/* 이름 입력칸 (복사/붙여넣기 지원) */}
                            <input
                              type="text"
                              value={s.name}
                              onChange={(e) =>
                                handleNameChange(
                                  grade,
                                  cls,
                                  num,
                                  e.target.value
                                )
                              }
                              onPaste={(e) => handlePaste(grade, cls, num, e)}
                              placeholder="이름"
                              className="w-[76px] px-2 py-1 rounded-lg border border-gray-300 text-sm shadow-inner text-gray-900 bg-white shrink-0"
                            />

                            {/* 매칭 상태 배지 또는 동명이인 선택 드롭다운 */}
                            <div className="flex-1 min-w-[92px] flex items-center">
                              {matchInfo?.status === "freshman" && (
                                <span
                                  className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200 text-[11px] font-extrabold whitespace-nowrap"
                                  title="신입생: 학생 고유 비밀번호와 새 학부모 고유 토큰이 생성됩니다."
                                >
                                  🌱 신입생
                                </span>
                              )}

                              {matchInfo?.status === "matched" &&
                                matchInfo.matchedStudent && (
                                  <span
                                    className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-extrabold whitespace-nowrap"
                                    title={`기존 ${matchInfo.matchedStudent.student_id} 학생의 고유 비밀번호 및 학부모토큰(${matchInfo.matchedStudent.parent_token || "자동생성"})이 그대로 승계됩니다.`}
                                  >
                                    ✅ 구{" "}
                                    {getStudentNumber(
                                      matchInfo.matchedStudent.grade,
                                      matchInfo.matchedStudent.class,
                                      matchInfo.matchedStudent.number
                                    )}
                                  </span>
                                )}

                              {matchInfo?.status === "new_transfer" && (
                                <span
                                  className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200 text-[11px] font-extrabold whitespace-nowrap"
                                  title="기존 재학생 명단에 없는 이름입니다. 전입/신규 학생으로 학생 고유 비밀번호와 학부모 토큰이 새로 생성됩니다."
                                >
                                  🆕 전입/신규
                                </span>
                              )}

                              {matchInfo?.status === "duplicate" && (
                                <select
                                  value={s.selectedOldStudentId || ""}
                                  onChange={(e) =>
                                    handleSelectDuplicate(
                                      grade,
                                      cls,
                                      num,
                                      e.target.value
                                    )
                                  }
                                  className={`px-1.5 py-0.5 rounded-md border text-[11px] font-extrabold cursor-pointer ${s.selectedOldStudentId
                                      ? "bg-emerald-100 text-emerald-900 border-emerald-400"
                                      : "bg-amber-100 text-amber-900 border-amber-400"
                                    }`}
                                  title="동명이인이 있습니다. 작년 몇 반 몇 번 학생인지 선택해 주세요."
                                >
                                  <option value="">⚠️ 동명이인 선택</option>
                                  {matchInfo.candidates.map((cand) => (
                                    <option
                                      key={cand.student_id}
                                      value={cand.student_id}
                                    >
                                      구{" "}
                                      {getStudentNumber(
                                        cand.grade,
                                        cand.class,
                                        cand.number
                                      )}{" "}
                                      ({cand.name})
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* 시뮬레이션 / 실행 결과 리포트 모달 */}
      {isResultModalOpen && simulationResult?.summary && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setIsResultModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden text-gray-900 border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-gray-900">
                    {simulationResult.mode === "simulation"
                      ? "🧪 새학기 진급 시뮬레이션 리포트 (모의 테스트)"
                      : "✅ 새학기 진급 처리 완료 리포트"}
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${simulationResult.mode === "simulation"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-emerald-100 text-emerald-800"
                      }`}
                  >
                    {simulationResult.mode === "simulation"
                      ? "DB 변경 없음 (안전)"
                      : "실제 DB 반영 완료"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {simulationResult.message}
                </p>
              </div>
              <button
                onClick={() => setIsResultModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-500 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 text-xs">
              {/* 핵심 수치 요약 카드 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
                  <div className="text-rose-600 font-bold">3학년 졸업 정리</div>
                  <div className="text-xl font-black text-rose-900 mt-1">
                    {simulationResult.summary.graduatingCount}명
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <div className="text-emerald-700 font-bold">
                    재학생 진급 (비번·토큰 유지)
                  </div>
                  <div className="text-xl font-black text-emerald-900 mt-1">
                    {simulationResult.summary.promotedGrade1To2Count +
                      simulationResult.summary.promotedGrade2To3Count}
                    명
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">
                    2학년 {simulationResult.summary.promotedGrade1To2Count}명 / 3학년{" "}
                    {simulationResult.summary.promotedGrade2To3Count}명
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200">
                  <div className="text-blue-700 font-bold">
                    1학년 신입생 신규 생성
                  </div>
                  <div className="text-xl font-black text-blue-900 mt-1">
                    {simulationResult.summary.newFreshmanCount}명
                  </div>
                  {simulationResult.summary.newTransferCount > 0 && (
                    <div className="text-[11px] text-blue-700 mt-0.5">
                      + 2·3학년 전입생 {simulationResult.summary.newTransferCount}명
                    </div>
                  )}
                </div>
                <div className="p-3 rounded-2xl bg-violet-50 border border-violet-200">
                  <div className="text-violet-700 font-bold">
                    승계된 개인비번 / 푸시알림
                  </div>
                  <div className="text-xl font-black text-violet-900 mt-1">
                    {simulationResult.summary.preservedCustomPasswordCount}명 /{" "}
                    {simulationResult.summary.preservedPushSubscriptionCount}건
                  </div>
                </div>
              </div>

              {/* CSV 미리 다운로드 버튼들 */}
              <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-gray-800">
                  📥 계정 및 학부모토큰 명단 CSV 다운로드 (시뮬레이션 상태에서도 확인 가능)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDownloadResultCsv(1)}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                  >
                    1학년(신입생) CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadResultCsv(2)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                  >
                    2학년 CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadResultCsv(3)}
                    className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer"
                  >
                    3학년 CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadResultCsv()}
                    className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-900 text-white font-bold cursor-pointer"
                  >
                    전교생 통합 CSV
                  </button>
                </div>
              </div>

              {/* 진급생 매칭 상세 미리보기 표 */}
              <div>
                <h4 className="font-extrabold text-sm text-gray-900 mb-2">
                  📈 진급생 학번 변경 및 정보 승계 내역 (
                  {simulationResult.summary.promotedPreview.length}명)
                </h4>
                <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="p-2 border-b">이름</th>
                        <th className="p-2 border-b">이전 아이디(학번)</th>
                        <th className="p-2 border-b">➔ 새 아이디(학번)</th>
                        <th className="p-2 border-b">비밀번호 승계</th>
                        <th className="p-2 border-b">유지된 학부모토큰</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulationResult.summary.promotedPreview.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="p-4 text-center text-gray-400"
                          >
                            매칭된 진급생이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        simulationResult.summary.promotedPreview.map(
                          (p: any) => (
                            <tr
                              key={p.student_id}
                              className="border-b border-gray-100 hover:bg-gray-50"
                            >
                              <td className="p-2 font-bold">{p.name}</td>
                              <td className="p-2 text-gray-500">
                                {p.old_student_id}
                              </td>
                              <td className="p-2 font-extrabold text-emerald-700">
                                {p.student_id}
                              </td>
                              <td className="p-2 text-gray-800">{p.password_status}</td>
                              <td className="p-2 font-mono text-gray-700">
                                {p.parent_token}
                              </td>
                            </tr>
                          )
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 신입생/전입생 신규 생성 내역 미리보기 표 */}
              <div>
                <h4 className="font-extrabold text-sm text-gray-900 mb-2">
                  🌱 신입생 및 전입생 신규 계정 생성 내역 (
                  {simulationResult.summary.newCreatedPreview.length}명)
                </h4>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="p-2 border-b">이름</th>
                        <th className="p-2 border-b">새 아이디(학번)</th>
                        <th className="p-2 border-b">생성된 학생 고유 비번</th>
                        <th className="p-2 border-b">생성된 학부모 고유 토큰</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulationResult.summary.newCreatedPreview.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="p-4 text-center text-gray-400"
                          >
                            신규 생성 대상 신입생/전입생이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        simulationResult.summary.newCreatedPreview.map(
                          (n: any) => (
                            <tr
                              key={n.student_id}
                              className="border-b border-gray-100 hover:bg-gray-50"
                            >
                              <td className="p-2 font-bold">{n.name}</td>
                              <td className="p-2 font-extrabold text-blue-700">
                                {n.student_id}
                              </td>
                              <td className="p-2 font-mono font-bold text-gray-900">
                                {n.temp_password}
                              </td>
                              <td className="p-2 font-mono text-gray-700">
                                {n.parent_token}
                              </td>
                            </tr>
                          )
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsResultModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-gray-900 text-white font-bold text-xs cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

