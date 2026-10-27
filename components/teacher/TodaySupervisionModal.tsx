'use client';

import React from 'react';
import { HiX, HiClock } from 'react-icons/hi';
import { DaySupervision } from '@/lib/supervisionParser';

interface TodaySupervisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayData: DaySupervision | null;
  year: number;
  month: number;
  myTeacherName?: string;
}

export const TodaySupervisionModal: React.FC<TodaySupervisionModalProps> = ({
  isOpen,
  onClose,
  dayData,
  year,
  month,
  myTeacherName = '',
}) => {
  if (!isOpen || !dayData) return null;

  const cleanName = myTeacherName.trim();
  const isMine = (name?: string) => {
    if (!cleanName || !name) return false;
    return name.replace(/^#/, '').trim().includes(cleanName);
  };

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

  const renderDutyName = (name?: string, highlighted: boolean = false) => {
    if (!name || name.trim() === '-' || name.trim() === '') return '-';
    const clean = name.replace(/^#/, '').trim();
    if (!clean || clean === '-') return '-';

    if (clean.includes('/')) {
      const parts = clean.split('/');
      return (
        <span className="inline-flex flex-col items-center justify-center leading-tight">
          <span>{parts[0].trim()}</span>
          <span className={`text-[10px] font-semibold tracking-tight ${highlighted ? 'text-amber-800' : 'text-slate-500'}`}>
            /{parts.slice(1).join('/')}
          </span>
        </span>
      );
    }
    return clean;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black bg-slate-100 text-slate-800 border border-slate-200">
              {dayData.day}
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {year}년 {month}월 {dayData.day}일 ({dayData.dow}요일)
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {!dayData.isWeekend && hasWeekendDuty(dayData)
                  ? '공휴일 / 귀교일 감독 시간표'
                  : dayData.isWeekend
                  ? '주말 / 휴일 감독 시간표'
                  : '평일 정규 감독 시간표'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition cursor-pointer"
          >
            <HiX className="w-5 h-5" />
          </button>
        </div>

        {/* Note banner if present */}
        {dayData.note && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-2">
            <span className="text-sm">📌</span>
            <span>비고: {dayData.note}</span>
          </div>
        )}

        {/* Timetable Details */}
        <div className="space-y-3">
          {/* 평일 감독 배정 */}
          {hasWeekdayDuty(dayData) && (
            <div className="space-y-2.5">
              <div className="text-xs font-black text-slate-700 px-1">평일 정규 감독 배정</div>

              {/* 1차: 방과후 (8·9교시) */}
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center text-xs font-black text-slate-800">
                  <span className="flex items-center gap-1.5 text-slate-800">
                    <HiClock className="w-3.5 h-3.5 text-slate-500" />
                    <span>16:30 ~ 18:20 (방과후 1차)</span>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { room: '1실', name: dayData.weekday.room1.afterSchool },
                    { room: '2실', name: dayData.weekday.room2.afterSchool },
                    { room: '3실', name: dayData.weekday.room3.afterSchool },
                  ].map((r, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        isMine(r.name)
                          ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-300/60 font-bold'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <span className="text-[10px] text-slate-500 block font-bold">{r.room}</span>
                      <span
                        className={`text-xs font-black ${
                          isMine(r.name) ? 'text-amber-900' : 'text-slate-800'
                        }`}
                      >
                        {renderDutyName(r.name, isMine(r.name))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2차: 야간 1차 (야간 1·2교시) */}
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center text-xs font-black text-slate-800">
                  <span className="flex items-center gap-1.5 text-slate-800">
                    <HiClock className="w-3.5 h-3.5 text-slate-500" />
                    <span>19:30 ~ 21:20 (야간 1차)</span>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { room: '1실', name: dayData.weekday.room1.night1 },
                    { room: '2실', name: dayData.weekday.room2.night1 },
                    { room: '3실', name: dayData.weekday.room3.night1 },
                  ].map((r, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        isMine(r.name)
                          ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-300/60 font-bold'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <span className="text-[10px] text-slate-500 block font-bold">{r.room}</span>
                      <span
                        className={`text-xs font-black ${
                          isMine(r.name) ? 'text-amber-900' : 'text-slate-800'
                        }`}
                      >
                        {renderDutyName(r.name, isMine(r.name))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3차: 야간 2차 (야간 3·4교시) */}
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center text-xs font-black text-slate-800">
                  <span className="flex items-center gap-1.5 text-slate-800">
                    <HiClock className="w-3.5 h-3.5 text-slate-500" />
                    <span>21:20 ~ 23:30 (야간 2차)</span>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { room: '1실', name: dayData.weekday.room1.night2 },
                    { room: '2실', name: dayData.weekday.room2.night2 },
                    { room: '3실', name: dayData.weekday.room3.night2 },
                  ].map((r, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        isMine(r.name)
                          ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-300/60 font-bold'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <span className="text-[10px] text-slate-500 block font-bold">{r.room}</span>
                      <span
                        className={`text-xs font-black ${
                          isMine(r.name) ? 'text-amber-900' : 'text-slate-800'
                        }`}
                      >
                        {renderDutyName(r.name, isMine(r.name))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 주말 / 휴일 감독 배정 */}
          {hasWeekendDuty(dayData) && (
            <div className="space-y-2.5">
              <div className="text-xs font-black text-slate-800 px-1">
                {!dayData.isWeekend ? '공휴일 / 귀교일 감독 배정' : '주말 / 휴일 감독 배정'}
              </div>

              {/* 1실 */}
              <div className="p-3 rounded-xl border space-y-2 bg-slate-50/80 border-slate-200">
                <span className="text-xs font-extrabold text-slate-800 block">
                  1실 감독 (오전 / 오후 / 야간 / 사감)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: '오전 (09:00~13:15)', name: dayData.weekend.room1.morning },
                    { label: '오후 (13:10~17:25)', name: dayData.weekend.room1.afternoon },
                    { label: '야간 (17:20~21:20)', name: dayData.weekend.room1.night },
                    { label: '사감 (21:20~22:20)', name: dayData.weekend.room1.nightCare },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        isMine(item.name)
                          ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-300/60'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <span className="text-[10px] text-slate-400 block font-bold">{item.label}</span>
                      <span
                        className={`text-xs font-black ${
                          isMine(item.name) ? 'text-amber-900' : 'text-slate-800'
                        }`}
                      >
                        {renderDutyName(item.name, isMine(item.name))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2실 & 3실 사감 근무 */}
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-extrabold text-slate-800 block">
                  2실 & 3실 사감 근무
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    className={`p-2.5 rounded-lg border bg-white ${
                      isMine(dayData.weekend.room2.dayCare) || isMine(dayData.weekend.room2.nightCare)
                        ? 'bg-amber-50/50 border-amber-300'
                        : 'border-slate-200'
                    }`}
                  >
                    <span className="text-[10px] text-slate-500 font-bold block mb-1">2실</span>
                    <div className="text-xs space-y-0.5">
                      <div>
                        <span className="text-slate-400">주간:</span>{' '}
                        <span className="font-bold text-slate-800">
                          {renderDutyName(dayData.weekend.room2.dayCare, isMine(dayData.weekend.room2.dayCare))}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">야간:</span>{' '}
                        <span className="font-bold text-slate-800">
                          {renderDutyName(dayData.weekend.room2.nightCare, isMine(dayData.weekend.room2.nightCare))}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`p-2.5 rounded-lg border bg-white ${
                      isMine(dayData.weekend.room3.dayCare) || isMine(dayData.weekend.room3.nightCare)
                        ? 'bg-amber-50/50 border-amber-300'
                        : 'border-slate-200'
                    }`}
                  >
                    <span className="text-[10px] text-slate-500 font-bold block mb-1">3실</span>
                    <div className="text-xs space-y-0.5">
                      <div>
                        <span className="text-slate-400">주간:</span>{' '}
                        <span className="font-bold text-slate-800">
                          {renderDutyName(dayData.weekend.room3.dayCare, isMine(dayData.weekend.room3.dayCare))}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">야간:</span>{' '}
                        <span className="font-bold text-slate-800">
                          {renderDutyName(dayData.weekend.room3.nightCare, isMine(dayData.weekend.room3.nightCare))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 배정 없음 */}
          {!hasWeekdayDuty(dayData) && !hasWeekendDuty(dayData) && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
              배정된 학습실 감독이 없습니다. (귀가일 또는 휴무)
            </div>
          )}

          {/* 귀교 지도 교사 */}
          {dayData.returnGuide && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">귀교 지도 교사</span>
                <span className="text-[11px] text-slate-500">학생 기숙사 복귀 지도 및 점호</span>
              </div>
              <span
                className={`text-sm font-black px-2.5 py-1 rounded-lg border shadow-2xs ${
                  isMine(dayData.returnGuide)
                    ? 'bg-amber-50 border-amber-300 text-amber-900 ring-2 ring-amber-300/60'
                    : 'bg-white border-slate-200 text-slate-900'
                }`}
              >
                {renderDutyName(dayData.returnGuide, isMine(dayData.returnGuide))}
              </span>
            </div>
          )}
        </div>

        {/* 닫기 버튼 */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
