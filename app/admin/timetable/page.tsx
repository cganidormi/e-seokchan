"use client";  // ← 이거 무조건 제일 위

import { useState } from "react";

export default function TimetablePage() {
  const [timetable, setTimetable] = useState({
    "0교시": "08:00~08:30",
    "1교시": "08:30~09:20",
    "2교시": "09:30~10:20",
    "3교시": "10:30~11:20",
    "4교시": "11:30~12:20",
    "5교시": "12:30~13:20",
    "6교시": "13:30~14:20",
    "7교시": "14:30~15:20",
    "8교시": "15:30~16:20",
    "9교시": "16:30~17:20",
    "야간 자습": "19:00~20:00",
  });

  const handleChange = (period: string, value: string) => {
    setTimetable({ ...timetable, [period]: value });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">일과표 관리</h1>
      <div className="flex flex-col gap-2">
        {Object.entries(timetable).map(([period, time]) => (
          <div key={period} className="flex gap-2 items-center">
            <span className="w-24 font-semibold">{period}</span>
            <input
              type="text"
              value={time}
              onChange={(e) => handleChange(period, e.target.value)}
              className="flex-1 p-1 rounded-md border border-gray-300"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
