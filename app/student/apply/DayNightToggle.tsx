"use client";
import { BsSunFill, BsMoonFill } from "react-icons/bs";

export default function DayNightToggle({
  periodType,
  onToggle,
}: {
  periodType: "주간" | "야간";
  onToggle: () => void;
}) {
  const toggleWidth = 48;
  const togglePadding = 2;
  const buttonWidth = 22;
  const translateX =
    periodType === "주간" ? 0 : toggleWidth - buttonWidth - togglePadding * 2;
  const bgColor = periodType === "주간" ? "#e0e0e0" : "#4b5563";

  return (
    <div
      className="relative h-6 rounded-full flex items-center p-0.5 cursor-pointer transition-colors duration-300"
      style={{ width: `${toggleWidth}px`, backgroundColor: bgColor }}
      onClick={onToggle}
    >
      <div
        className="h-5 bg-white rounded-full flex items-center justify-center shadow-md transition-transform duration-300 ease-in-out"
        style={{
          width: `${buttonWidth}px`,
          transform: `translateX(${translateX}px)`,
        }}
      >
        {periodType === "주간" ? (
          <BsSunFill className="text-yellow-400" />
        ) : (
          <BsMoonFill className="text-gray-800" />
        )}
      </div>
    </div>
  );
}
