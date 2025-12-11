"use client";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export default function TimeRangePicker({
  startTime,
  endTime,
  setStartTime,
  setEndTime,
  type,
}: {
  startTime: Date | null;
  endTime: Date | null;
  setStartTime: (d: Date | null) => void;
  setEndTime: (d: Date | null) => void;
  type: string;
}) {
  const timeInputClass =
    "p-1.5 rounded-full bg-gray-300 border-none focus:outline-none h-8 w-44 text-[12px] text-left pr-3 box-border";

  return (
    <div className="flex gap-6 items-center h-8">
      <DatePicker
        selected={startTime}
        onChange={setStartTime}
        showTimeSelect
        {...(type === "출"
          ? { showTimeSelectOnly: true, dateFormat: "HH:mm" }
          : { dateFormat: "yyyy-MM-dd HH:mm" })}
        timeIntervals={10}
        placeholderText="시작"
        className={timeInputClass}
        popperPlacement="bottom-start"
        portalId="time-picker-portal"
      />
      <DatePicker
        selected={endTime}
        onChange={setEndTime}
        showTimeSelect
        {...(type === "출"
          ? { showTimeSelectOnly: true, dateFormat: "HH:mm" }
          : { dateFormat: "yyyy-MM-dd HH:mm" })}
        timeIntervals={10}
        placeholderText="종료"
        className={timeInputClass}
        popperPlacement="bottom-start"
        portalId="time-picker-portal"
      />
    </div>
  );
}
