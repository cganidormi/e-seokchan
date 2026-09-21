import React from 'react';

interface SwipeNudgeDotsProps {
  currentIndex: number;
  className?: string;
  theme?: 'light' | 'dark';
}

export default function SwipeNudgeDots({ currentIndex, className, theme = 'light' }: SwipeNudgeDotsProps) {
  const isDark = theme === 'dark';
  return (
    <div className={`flex items-center justify-center gap-2 pointer-events-none ${className || ''}`}>
      {[0, 1, 2].map((idx) => (
        <div
          key={idx}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            currentIndex === idx
              ? (isDark ? 'bg-white w-4' : 'bg-gray-800 w-4')
              : (isDark ? 'bg-white/40 w-1.5 opacity-50' : 'bg-gray-400 w-1.5 opacity-60')
          }`}
        />
      ))}
    </div>
  );
}
