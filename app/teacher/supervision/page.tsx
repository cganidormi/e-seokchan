"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";
import * as XLSX from "xlsx";
import {
  HiHome,
  HiChevronLeft,
  HiChevronRight,
  HiUpload,
  HiViewList,
  HiSearch,
  HiX,
  HiClock,
} from "react-icons/hi";
import {
  SupervisionScheduleData,
  DaySupervision,
  parseSupervisionWorkbook,
} from "@/lib/supervisionParser";
import { supabase } from "@/supabaseClient";
import initialData from "@/lib/initialSupervisionData.json";

export default function SupervisionPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [scheduleData, setScheduleData] = useState<SupervisionScheduleData>(
    initialData as SupervisionScheduleData
  );
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(3);
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [activeDayDetail, setActiveDayDetail] = useState<DaySupervision | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Initialize month based on current real-world date & auto-select logged-in teacher
  useEffect(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    if (currentMonth >= 3 && currentMonth <= 12) {
      setSelectedMonth(currentMonth);
    } else {
      setSelectedMonth(3);
    }

    const resolveLoggedInTeacher = async () => {
      const storedName =
        typeof window !== "undefined"
          ? localStorage.getItem("dormichan_teacher_name") ||
            sessionStorage.getItem("dormichan_teacher_name")
          : "";
      const loginId =
        typeof window !== "undefined"
          ? localStorage.getItem("dormichan_login_id") ||
            sessionStorage.getItem("dormichan_login_id")
          : "";
      const role =
        typeof window !== "undefined"
          ? localStorage.getItem("dormichan_role") ||
            sessionStorage.getItem("dormichan_role")
          : "";

      // Skip auto-fill if admin
      if (role === "admin" || loginId === "admin") return;

      if (storedName) {
        setSelectedTeacher(storedName.trim());
        return;
      }

      if (loginId) {
        const trimmed = loginId.trim();
        setSelectedTeacher(trimmed);

        // In case loginId was an ID code, verify & fetch exact Korean name from teachers table
        try {
          const { data } = await supabase
            .from("teachers")
            .select("name")
            .or(`name.eq.${trimmed},teacher_id.eq.${trimmed}`)
            .limit(1);

          if (data && data.length > 0 && data[0].name) {
            setSelectedTeacher(data[0].name.trim());
          }
        } catch (e) {
          // fallback to loginId
        }
      }
    };

    resolveLoggedInTeacher();
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    try {
      const res = await fetch("/api/teacher/supervision-schedule");
      if (res.ok) {
        const data = await res.json();
        if (data.schedule && data.schedule.months) {
          setScheduleData(data.schedule);
          if (data.schedule.year) {
            setSelectedYear(data.schedule.year);
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch supervision schedule:", e);
    }
  };

  // Helper functions to check if a day has duty recorded
  const hasWeekdayDuty = (d: DaySupervision): boolean => {
    return !!(
      d.weekday.room1.afterSchool ||
      d.weekday.room1.night1 ||
      d.weekday.room1.night2 ||
      d.weekday.room2.afterSchool ||
      d.weekday.room2.night1 ||
      d.weekday.room2.night2 ||
      d.weekday.room3.afterSchool ||
      d.weekday.room3.night1 ||
      d.weekday.room3.night2
    );
  };

  const hasWeekendDuty = (d: DaySupervision): boolean => {
    return !!(
      d.weekend.room1.morning ||
      d.weekend.room1.afternoon ||
      d.weekend.room1.night ||
      d.weekend.room1.nightCare ||
      d.weekend.room2.dayCare ||
      d.weekend.room2.nightCare ||
      d.weekend.room3.dayCare ||
      d.weekend.room3.nightCare
    );
  };

  // Handle Excel File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const toastId = toast.loading("엑셀 파일 분석 중...");

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const parsed = parseSupervisionWorkbook(wb, file.name);

      if (!parsed.months || Object.keys(parsed.months).length === 0) {
        throw new Error("월별 시트('3월', '4월' 등)를 찾을 수 없습니다.");
      }

      const res = await fetch("/api/teacher/supervision-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule: parsed, fileName: file.name }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "서버 저장에 실패했습니다.");
      }

      setScheduleData(parsed);
      setSelectedYear(parsed.year);
      toast.success(`${file.name} 감독표 업로드 및 저장 완료!`, { id: toastId });
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err.message || "파일 업로드 중 오류가 발생했습니다.", { id: toastId });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const availableMonths = useMemo(() => {
    if (!scheduleData.months) return [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const keys = Object.keys(scheduleData.months)
      .map(Number)
      .sort((a, b) => a - b);
    return keys.length > 0 ? keys : [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }, [scheduleData]);

  const currentMonthData = useMemo(() => {
    return scheduleData.months?.[selectedMonth]?.days || [];
  }, [scheduleData, selectedMonth]);

  const allTeachersList = useMemo(() => {
    const names = new Set<string>();
    Object.values(scheduleData.months || {}).forEach((m) => {
      m.days.forEach((d) => {
        const add = (n: string) => {
          if (!n) return;
          const clean = n.replace(/^#/, "").trim();
          if (clean && clean !== "-" && clean.length >= 2) {
            names.add(clean);
          }
        };
        add(d.weekday.room1.afterSchool);
        add(d.weekday.room1.night1);
        add(d.weekday.room1.night2);
        add(d.weekday.room2.afterSchool);
        add(d.weekday.room2.night1);
        add(d.weekday.room2.night2);
        add(d.weekday.room3.afterSchool);
        add(d.weekday.room3.night1);
        add(d.weekday.room3.night2);
        add(d.weekend.room1.morning);
        add(d.weekend.room1.afternoon);
        add(d.weekend.room1.night);
        add(d.weekend.room1.nightCare);
        add(d.weekend.room2.dayCare);
        add(d.weekend.room2.nightCare);
        add(d.weekend.room3.dayCare);
        add(d.weekend.room3.nightCare);
        add(d.returnGuide);
      });
    });
    return Array.from(names).sort();
  }, [scheduleData]);

  // Check if a day has duty for selectedTeacher across all rooms
  const dayMatchesTeacher = (d: DaySupervision): boolean => {
    if (!selectedTeacher) return false;
    const clean = selectedTeacher.trim();
    const check = (n: string) => Boolean(n && n.replace(/^#/, "").trim().includes(clean));

    return Boolean(
      check(d.weekday.room1.afterSchool) ||
      check(d.weekday.room1.night1) ||
      check(d.weekday.room1.night2) ||
      check(d.weekend.room1.morning) ||
      check(d.weekend.room1.afternoon) ||
      check(d.weekend.room1.night) ||
      check(d.weekend.room1.nightCare) ||
      check(d.weekday.room2.afterSchool) ||
      check(d.weekday.room2.night1) ||
      check(d.weekday.room2.night2) ||
      check(d.weekend.room2.dayCare) ||
      check(d.weekend.room2.nightCare) ||
      check(d.weekday.room3.afterSchool) ||
      check(d.weekday.room3.night1) ||
      check(d.weekday.room3.night2) ||
      check(d.weekend.room3.dayCare) ||
      check(d.weekend.room3.nightCare) ||
      check(d.returnGuide)
    );
  };

  // Teacher monthly duty statistics
  const teacherStats = useMemo(() => {
    if (!selectedTeacher) return null;
    let total = 0;
    let weekdayCount = 0;
    let weekendCount = 0;
    const dutyDays: number[] = [];

    currentMonthData.forEach((d) => {
      if (dayMatchesTeacher(d)) {
        total++;
        if (d.isWeekend || hasWeekendDuty(d)) weekendCount++;
        else weekdayCount++;
        dutyDays.push(d.day);
      }
    });

    return { total, weekdayCount, weekendCount, dutyDays };
  }, [selectedTeacher, currentMonthData]);

  // Calendar Grid Preparation
  const calendarCells = useMemo(() => {
    if (!currentMonthData.length) return [];
    const firstDay = currentMonthData[0];
    const dowMap: Record<string, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
    const firstDowIndex = dowMap[firstDay.dow] ?? 0;

    const cells: (DaySupervision | null)[] = [];
    for (let i = 0; i < firstDowIndex; i++) {
      cells.push(null);
    }
    currentMonthData.forEach((d) => cells.push(d));
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return cells;
  }, [currentMonthData]);

  const changeMonth = (delta: number) => {
    const currentIndex = availableMonths.indexOf(selectedMonth);
    if (currentIndex === -1) return;
    const nextIndex = currentIndex + delta;
    if (nextIndex >= 0 && nextIndex < availableMonths.length) {
      setSelectedMonth(availableMonths[nextIndex]);
    }
  };

  const renderBadgeName = (
    name: string,
    rolePrefix?: string,
    roomTheme?: "emerald" | "blue" | "purple" | "amber" | "default"
  ) => {
    if (!name) return null;
    const isSpecial = name.startsWith("#");
    const clean = name.replace(/^#/, "").trim();
    const isTarget = selectedTeacher && clean.includes(selectedTeacher.trim());

    if (isTarget) {
      return (
        <span
          className="inline-block px-1.5 py-0.5 rounded text-[11px] font-black bg-amber-400 text-gray-950 ring-2 ring-amber-500 scale-105 shadow-xs transition-all"
          title={`${rolePrefix ? rolePrefix + ": " : ""}${name}`}
        >
          {rolePrefix && <span className="text-[9px] opacity-75 mr-0.5">{rolePrefix}</span>}
          {clean}
        </span>
      );
    }

    let themeCls = "bg-gray-100 text-gray-800";
    if (roomTheme === "emerald") themeCls = "bg-emerald-50 text-emerald-800 border border-emerald-200/60";
    else if (roomTheme === "blue") themeCls = "bg-blue-50 text-blue-800 border border-blue-200/60";
    else if (roomTheme === "purple") themeCls = "bg-purple-50 text-purple-800 border border-purple-200/60";
    else if (roomTheme === "amber") themeCls = "bg-amber-50 text-amber-900 border border-amber-200/60";

    if (isSpecial) {
      themeCls = "bg-rose-50 text-rose-700 border border-rose-200";
    }

    return (
      <span
        className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold truncate transition-all ${themeCls}`}
        title={`${rolePrefix ? rolePrefix + ": " : ""}${name}`}
      >
        {rolePrefix && <span className="text-[9px] opacity-70 mr-0.5 font-bold">{rolePrefix}</span>}
        {clean}
      </span>
    );
  };

  return (
    <div className="p-3 md:p-6 bg-[#f8fafc] min-h-screen text-gray-900">
      <Toaster position="top-right" />

      {/* Top Header */}
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-gray-900">양현재 감독표</h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-teal-50 text-[#0E8694] border border-teal-200">
                  {selectedYear}학년도
                </span>
              </div>
              <p className="text-xs text-gray-500 hidden sm:block">
                월별 학습실 감독교사 배정 현황 및 주말·귀교 지도 일정표
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx, .xls"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="h-10 px-3.5 rounded-xl bg-white hover:bg-gray-50 border border-emerald-300 hover:border-emerald-500 text-emerald-700 shadow-sm transition-all flex items-center gap-1.5 text-xs md:text-sm font-bold cursor-pointer active:scale-95 shrink-0"
              title="새로운 엑셀 감독표 파일 업로드"
            >
              <HiUpload className="w-4 h-4 text-emerald-600" />
              <span>{isUploading ? "업로드 중..." : "엑셀 업로드"}</span>
            </button>

            <Link
              href="/teacher"
              className="h-10 w-10 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 shadow-sm transition-all flex items-center justify-center cursor-pointer shrink-0 active:scale-95"
              title="교사 홈으로 이동"
            >
              <HiHome className="w-5 h-5 text-gray-700" />
            </Link>
          </div>
        </div>

        {/* Month Selector Bar & View Mode Controls */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-3 md:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Month Nav Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                disabled={availableMonths.indexOf(selectedMonth) <= 0}
                className="w-9 h-9 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                title="이전 달"
              >
                <HiChevronLeft className="w-5 h-5" />
              </button>

              <div className="text-lg md:text-xl font-black text-gray-900 min-w-[120px] text-center">
                {selectedYear}년 {selectedMonth}월
              </div>

              <button
                type="button"
                onClick={() => changeMonth(1)}
                disabled={availableMonths.indexOf(selectedMonth) >= availableMonths.length - 1}
                className="w-9 h-9 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                title="다음 달"
              >
                <HiChevronRight className="w-5 h-5" />
              </button>

              {/* Month Pills for fast jump */}
              <div className="hidden lg:flex items-center gap-1 ml-2">
                {availableMonths.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSelectedMonth(m)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedMonth === m
                        ? "bg-[#0E8694] text-white shadow-xs"
                        : "bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200/60"
                    }`}
                  >
                    {m}월
                  </button>
                ))}
              </div>
            </div>

            {/* Filter by Teacher & View Toggle */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="relative flex-1 sm:w-56">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                  <HiSearch className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  list="teachers-datalist"
                  value={selectedTeacher}
                  onChange={(e) => setSelectedTeacher(e.target.value)}
                  placeholder="내 이름 검색 (감독일 강조)"
                  className="w-full pl-8 pr-7 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-[#0E8694] focus:border-transparent transition-all"
                />
                <datalist id="teachers-datalist">
                  {allTeachersList.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                {selectedTeacher && (
                  <button
                    type="button"
                    onClick={() => setSelectedTeacher("")}
                    className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <HiX className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* View Mode: 목록만 유지 */}
              <div className="flex items-center px-3 py-1.5 bg-gray-100 rounded-xl border border-gray-200 text-xs font-bold text-gray-800 gap-1.5 shrink-0 shadow-2xs">
                <HiViewList className="w-3.5 h-3.5 text-[#0E8694]" />
                <span>목록</span>
              </div>
            </div>
          </div>

          {/* Teacher Duty Summary & Sleek Mini Calendar Card */}
          {teacherStats && selectedTeacher && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 space-y-3.5 transition-all animate-fadeIn">
              {/* Header Info Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60">
                      개인 감독 일정
                    </span>
                    <h3 className="text-base font-black text-slate-900 tracking-tight">
                      {selectedTeacher} 선생님
                    </h3>
                  </div>

                  <div className="text-xs text-slate-500 font-medium">
                    {selectedMonth}월 배정 감독:{" "}
                    <span className="text-sm font-black text-slate-900">{teacherStats.total}회</span>
                    <span className="text-slate-400 mx-1.5">|</span>
                    <span>평일 {teacherStats.weekdayCount}회</span>
                    <span className="text-slate-400 mx-1">·</span>
                    <span>주말 및 공휴일 {teacherStats.weekendCount}회</span>
                  </div>
                </div>

                {/* Legend & Quick Info */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-600 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    <span>근무일</span>
                  </span>
                </div>
              </div>

              {/* Minimalist Apple-Style Mini Calendar Widget */}
              <div className="max-w-xs sm:max-w-sm mx-auto bg-slate-50/70 rounded-xl p-3 border border-slate-200/60">
                {/* Weekday Labels */}
                <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 pb-2 border-b border-slate-200/50">
                  <span className="text-rose-500">일</span>
                  <span>월</span>
                  <span>화</span>
                  <span>수</span>
                  <span>목</span>
                  <span>금</span>
                  <span className="text-blue-500">토</span>
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-y-1 gap-x-0.5 pt-2 text-center">
                  {calendarCells.map((cell, idx) => {
                    if (!cell) {
                      return <div key={`sleek-empty-${idx}`} className="h-8" />;
                    }

                    const isDuty = teacherStats.dutyDays.includes(cell.day);
                    const isSun = cell.dow === "일";
                    const isSat = cell.dow === "토";

                    return (
                      <button
                        key={`sleek-day-${cell.day}`}
                        type="button"
                        onClick={() => setActiveDayDetail(cell)}
                        className={`h-8 w-8 mx-auto rounded-full flex flex-col items-center justify-center transition-all cursor-pointer relative ${
                          isDuty
                            ? "bg-white text-slate-900 font-black shadow-2xs ring-1 ring-slate-200 hover:ring-rose-400"
                            : "hover:bg-slate-200/50 text-slate-600 font-medium"
                        }`}
                        title={`${cell.day}일 (${cell.dow})${isDuty ? " - 근무일 (클릭 시 상세 일정)" : ""}`}
                      >
                        <span
                          className={`text-[11px] leading-none ${
                            isDuty
                              ? "font-black text-slate-900"
                              : isSun
                              ? "text-rose-500"
                              : isSat
                              ? "text-blue-500"
                              : "text-slate-600"
                          }`}
                        >
                          {cell.day}
                        </span>

                        {/* Refined Pin-point Red Dot */}
                        {isDuty ? (
                          <span className="w-1 h-1 rounded-full bg-rose-500 mt-0.5 shrink-0" />
                        ) : (
                          <span className="w-1 h-1 mt-0.5 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Duty Days Quick Jump List */}
              {teacherStats.dutyDays.length > 0 ? (
                <div className="flex items-center justify-center gap-1.5 flex-wrap pt-1 text-xs text-slate-600">
                  <span className="font-semibold text-slate-400 text-[11px]">배정 일자:</span>
                  {teacherStats.dutyDays.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        const targetDay = currentMonthData.find((d) => d.day === day);
                        if (targetDay) setActiveDayDetail(targetDay);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200/80 transition-colors cursor-pointer"
                    >
                      <span className="w-1 h-1 rounded-full bg-rose-500"></span>
                      <span>{day}일</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center text-xs text-slate-400 font-medium pt-1">
                  이번 달 배정된 근무가 없습니다.
                </div>
              )}
            </div>
          )}
        </div>



        {/* LIST / TABLE VIEW */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1 text-[11px] text-gray-500">
            <span className="font-bold text-gray-700">전체 학습실(1·2·3실) 감독 일정표</span>
            <span className="hidden sm:inline text-gray-400">행을 클릭하면 시간대별 세부 일정을 확인할 수 있습니다.</span>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-800">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold">
                <tr>
                  <th className="py-3 px-3 w-16 text-center">날짜</th>
                  <th className="py-3 px-2 w-12 text-center">요일</th>
                  <th className="py-3 px-3 bg-emerald-50/40 text-emerald-900">1실 감독</th>
                  <th className="py-3 px-3 bg-blue-50/40 text-blue-900">2실 감독</th>
                  <th className="py-3 px-3 bg-purple-50/40 text-purple-900">3실 감독</th>
                  <th className="py-3 px-3">귀교지도</th>
                  <th className="py-3 px-3">비고</th>
                  <th className="py-3 px-3 text-center w-16">상세</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentMonthData.map((d) => {
                  const isTarget = dayMatchesTeacher(d);
                  const isSunday = d.dow === "일";
                  const isSaturday = d.dow === "토";
                  const hasWeekend = hasWeekendDuty(d);
                  const hasWeekday = hasWeekdayDuty(d);
                  const isReturnOrHoliday = !d.isWeekend && hasWeekend;

                  return (
                    <tr
                      key={d.day}
                      onClick={() => setActiveDayDetail(d)}
                      className={`hover:bg-teal-50/40 transition cursor-pointer ${
                        isTarget
                          ? "bg-amber-50/80 font-bold"
                          : d.isWeekend
                          ? "bg-slate-50/40"
                          : isReturnOrHoliday
                          ? "bg-orange-50/20"
                          : "bg-white"
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center font-black">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs ${
                            isSunday
                              ? "text-rose-600 bg-rose-50"
                              : isSaturday
                              ? "text-blue-600 bg-blue-50"
                              : isReturnOrHoliday
                              ? "text-amber-800 bg-amber-100"
                              : "text-gray-800"
                          }`}
                        >
                          {d.day}일
                        </span>
                      </td>
                      <td
                        className={`py-2.5 px-2 text-center font-extrabold ${
                          isSunday ? "text-rose-600" : isSaturday ? "text-blue-600" : "text-gray-600"
                        }`}
                      >
                        {d.dow}
                      </td>

                      {/* Room 1 Column */}
                      <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {hasWeekday ? (
                              <>
                                {renderBadgeName(d.weekday.room1.afterSchool, "방과후", "emerald")}
                                {renderBadgeName(d.weekday.room1.night1, "야간1", "emerald")}
                                {renderBadgeName(d.weekday.room1.night2, "야간2", "default")}
                              </>
                            ) : hasWeekend ? (
                              <>
                                {renderBadgeName(d.weekend.room1.morning, "오전", "emerald")}
                                {renderBadgeName(d.weekend.room1.afternoon, "오후", "emerald")}
                                {renderBadgeName(d.weekend.room1.night, "야간", "emerald")}
                                {renderBadgeName(d.weekend.room1.nightCare, "사감", "default")}
                              </>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        </td>

                      {/* Room 2 Column */}
                      <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {hasWeekday ? (
                              <>
                                {renderBadgeName(d.weekday.room2.afterSchool, "방과후", "blue")}
                                {renderBadgeName(d.weekday.room2.night1, "야간1", "blue")}
                                {renderBadgeName(d.weekday.room2.night2, "야간2", "default")}
                              </>
                            ) : hasWeekend ? (
                              <>
                                {renderBadgeName(d.weekend.room2.dayCare, "주간사감", "blue")}
                                {renderBadgeName(d.weekend.room2.nightCare, "야간사감", "blue")}
                              </>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        </td>

                      {/* Room 3 Column */}
                      <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {hasWeekday ? (
                              <>
                                {renderBadgeName(d.weekday.room3.afterSchool, "방과후", "purple")}
                                {renderBadgeName(d.weekday.room3.night1, "야간1", "purple")}
                                {renderBadgeName(d.weekday.room3.night2, "야간2", "default")}
                              </>
                            ) : hasWeekend ? (
                              <>
                                {renderBadgeName(d.weekend.room3.dayCare, "주간사감", "purple")}
                                {renderBadgeName(d.weekend.room3.nightCare, "야간사감", "purple")}
                              </>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        </td>

                      <td className="py-2.5 px-3">
                        {d.returnGuide ? (
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {d.returnGuide}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-gray-500">{d.note || "-"}</td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[11px] font-bold cursor-pointer"
                        >
                          보기
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* DAY DETAIL MODAL */}
      {activeDayDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black bg-slate-100 text-slate-800 border border-slate-200">
                  {activeDayDetail.day}
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {selectedYear}년 {selectedMonth}월 {activeDayDetail.day}일 ({activeDayDetail.dow}
                    요일)
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    {!activeDayDetail.isWeekend && hasWeekendDuty(activeDayDetail)
                      ? "공휴일 / 귀교일 감독 시간표"
                      : activeDayDetail.isWeekend
                      ? "주말 / 휴일 감독 시간표"
                      : "평일 정규 감독 시간표"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveDayDetail(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition cursor-pointer"
              >
                <HiX className="w-5 h-5" />
              </button>
            </div>

            {/* Note banner if present */}
            {activeDayDetail.note && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-2">
                <span className="text-sm">📌</span>
                <span>비고: {activeDayDetail.note}</span>
              </div>
            )}

            {/* Timetable Details */}
            <div className="space-y-3">
              {/* Show Weekday details if weekday duties exist */}
              {hasWeekdayDuty(activeDayDetail) && (
                <div className="space-y-2.5">
                  <div className="text-xs font-black text-slate-700 px-1">평일 정규 감독 배정</div>

                  {/* Period 1 */}
                  <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-black text-slate-800">
                      <span className="flex items-center gap-1.5 text-slate-800">
                        <HiClock className="w-3.5 h-3.5 text-slate-500" />
                        <span>16:30 ~ 18:20 (방과후 1차)</span>
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">교사 근무</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div className={`p-2 rounded-lg border text-center bg-white border-slate-200`}>
                        <span className="text-[10px] text-slate-500 block font-bold">1실</span>
                        <span className="text-xs font-black text-slate-800">
                          {activeDayDetail.weekday.room1.afterSchool || "-"}
                        </span>
                      </div>
                      <div className={`p-2 rounded-lg border text-center bg-white border-slate-200`}>
                        <span className="text-[10px] text-slate-500 block font-bold">2실</span>
                        <span className="text-xs font-black text-slate-800">
                          {activeDayDetail.weekday.room2.afterSchool || "-"}
                        </span>
                      </div>
                      <div className={`p-2 rounded-lg border text-center bg-white border-slate-200`}>
                        <span className="text-[10px] text-slate-500 block font-bold">3실</span>
                        <span className="text-xs font-black text-slate-800">
                          {activeDayDetail.weekday.room3.afterSchool || "-"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Period 2 */}
                  <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-black text-slate-800">
                      <span className="flex items-center gap-1.5 text-slate-800">
                        <HiClock className="w-3.5 h-3.5 text-slate-500" />
                        <span>19:30 ~ 21:20 (야간 1차)</span>
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">교사 / 사감</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div className={`p-2 rounded-lg border text-center bg-white border-slate-200`}>
                        <span className="text-[10px] text-slate-500 block font-bold">1실</span>
                        <span className="text-xs font-black text-slate-800">
                          {activeDayDetail.weekday.room1.night1 || "-"}
                        </span>
                      </div>
                      <div className={`p-2 rounded-lg border text-center bg-white border-slate-200`}>
                        <span className="text-[10px] text-slate-500 block font-bold">2실</span>
                        <span className="text-xs font-black text-slate-800">
                          {activeDayDetail.weekday.room1.night1 ? activeDayDetail.weekday.room2.night1 || "-" : activeDayDetail.weekday.room2.night1 || "-"}
                        </span>
                      </div>
                      <div className={`p-2 rounded-lg border text-center bg-white border-slate-200`}>
                        <span className="text-[10px] text-slate-500 block font-bold">3실</span>
                        <span className="text-xs font-black text-slate-800">
                          {activeDayDetail.weekday.room3.night1 || "-"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Period 3 */}
                  <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-black text-slate-800">
                      <span className="flex items-center gap-1.5 text-slate-800">
                        <HiClock className="w-3.5 h-3.5 text-slate-500" />
                        <span>21:20 ~ 23:30 (야간 2차)</span>
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">사감 근무</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div className={`p-2 rounded-lg border text-center bg-white border-slate-200`}>
                        <span className="text-[10px] text-slate-500 block font-bold">1실</span>
                        <span className="text-xs font-black text-slate-800">
                          {activeDayDetail.weekday.room1.night2 || "-"}
                        </span>
                      </div>
                      <div className={`p-2 rounded-lg border text-center bg-white border-slate-200`}>
                        <span className="text-[10px] text-slate-500 block font-bold">2실</span>
                        <span className="text-xs font-black text-slate-800">
                          {activeDayDetail.weekday.room2.night2 || "-"}
                        </span>
                      </div>
                      <div className={`p-2 rounded-lg border text-center bg-white border-slate-200`}>
                        <span className="text-[10px] text-slate-500 block font-bold">3실</span>
                        <span className="text-xs font-black text-slate-800">
                          {activeDayDetail.weekday.room3.night2 || "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Show Weekend/Holiday/Return details if weekend duties exist */}
              {hasWeekendDuty(activeDayDetail) && (
                <div className="space-y-2.5">
                  <div className="text-xs font-black text-slate-800 px-1">
                    {!activeDayDetail.isWeekend ? "공휴일 / 귀교일 감독 배정" : "주말 / 휴일 감독 배정"}
                  </div>

                  {/* 1실 */}
                  <div className={`p-3 rounded-xl border space-y-2 bg-slate-50/80 border-slate-200`}>
                    <span className="text-xs font-extrabold text-slate-800 block">
                      1실 감독 (오전 / 오후 / 야간 / 사감)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="bg-white p-2 rounded-lg border border-slate-200 text-center">
                        <span className="text-[10px] text-slate-400 block font-bold">오전 (09:00~13:15)</span>
                        <span className="text-xs font-black text-slate-800">
                          {activeDayDetail.weekend.room1.morning || "-"}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200 text-center">
                        <span className="text-[10px] text-slate-400 block font-bold">오후 (13:10~17:25)</span>
                        <span className="text-xs font-black text-slate-800">
                          {activeDayDetail.weekend.room1.afternoon || "-"}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200 text-center">
                        <span className="text-[10px] text-slate-400 block font-bold">야간 (17:20~21:20)</span>
                        <span className="text-xs font-black text-slate-800">
                          {activeDayDetail.weekend.room1.night || "-"}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200 text-center">
                        <span className="text-[10px] text-slate-400 block font-bold">사감 (21:20~22:20)</span>
                        <span className="text-xs font-black text-slate-800">
                          {activeDayDetail.weekend.room1.nightCare || "-"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2실 & 3실 */}
                  <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-xs font-extrabold text-slate-800 block">
                      2실 & 3실 사감 근무
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className={`p-2.5 rounded-lg border bg-white border-slate-200`}>
                        <span className="text-[10px] text-slate-500 font-bold block mb-1">2실</span>
                        <div className="text-xs space-y-0.5">
                          <div>
                            <span className="text-slate-400">주간:</span>{" "}
                            <span className="font-bold text-slate-800">{activeDayDetail.weekend.room2.dayCare || "-"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">야간:</span>{" "}
                            <span className="font-bold text-slate-800">{activeDayDetail.weekend.room2.nightCare || "-"}</span>
                          </div>
                        </div>
                      </div>
                      <div className={`p-2.5 rounded-lg border bg-white border-slate-200`}>
                        <span className="text-[10px] text-slate-500 font-bold block mb-1">3실</span>
                        <div className="text-xs space-y-0.5">
                          <div>
                            <span className="text-slate-400">주간:</span>{" "}
                            <span className="font-bold text-slate-800">{activeDayDetail.weekend.room3.dayCare || "-"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">야간:</span>{" "}
                            <span className="font-bold text-slate-800">{activeDayDetail.weekend.room3.nightCare || "-"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* If no duty recorded at all */}
              {!hasWeekdayDuty(activeDayDetail) && !hasWeekendDuty(activeDayDetail) && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                  배정된 학습실 감독이 없습니다. (귀가일 또는 휴무)
                </div>
              )}

              {/* 귀교 지도 교사 */}
              {activeDayDetail.returnGuide && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">귀교 지도 교사</span>
                    <span className="text-[11px] text-slate-500">학생 기숙사 복귀 지도 및 점호</span>
                  </div>
                  <span className="text-sm font-black text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                    {activeDayDetail.returnGuide}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setActiveDayDetail(null)}
                className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition cursor-pointer"
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
