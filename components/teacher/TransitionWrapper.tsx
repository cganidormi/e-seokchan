'use client';

import React, { useRef, useContext, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { LayoutRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import toast from 'react-hot-toast';

function FrozenRoute({ children }: { children: React.ReactNode }) {
  const context = useContext(LayoutRouterContext);
  const frozen = useRef(context).current;

  if (!context) return <>{children}</>;

  return (
    <LayoutRouterContext.Provider value={frozen}>
      {children}
    </LayoutRouterContext.Provider>
  );
}

// 페이지 순서를 정의하여 어느 방향으로 스와이프하는지 계산합니다.
const PAGE_ORDER: Record<string, number> = {
  '/teacher': 0,
  '/teacher/seats': 1,
  '/teacher/headcount': 2,
};

export default function TransitionWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentIndex = PAGE_ORDER[pathname] ?? 0;
  
  // React 렌더링 주기에 안전하게 이전 인덱스를 기억하기 위해 useRef 사용
  const prevIndexRef = useRef(currentIndex);
  const directionRef = useRef(1);

  if (currentIndex !== prevIndexRef.current) {
    directionRef.current = currentIndex > prevIndexRef.current ? 1 : -1;
    prevIndexRef.current = currentIndex;
  }
  
  const direction = directionRef.current;

  // 최초 1회 스와이프 넛지 토스트 띄우기
  useEffect(() => {
    const hasSeenNudge = localStorage.getItem('has_seen_swipe_nudge');
    if (!hasSeenNudge) {
      const timer = setTimeout(() => {
        toast('새 기능: 화면을 좌우로 스와이프해서 메뉴를 이동해보세요!', {
          duration: 6000,
          position: 'bottom-center',
          icon: '👉',
          style: {
            borderRadius: '16px',
            background: '#1f2937',
            color: '#fff',
            fontWeight: 'bold',
            marginBottom: '40px' // 점 인디케이터 위에 표시되도록
          },
        });
        localStorage.setItem('has_seen_swipe_nudge', 'true');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  // 파워포인트처럼 연결되어 이동하는 슬라이드 효과 설정
  const variants = {
    initial: (dir: number) => ({
      x: dir > 0 ? '100vw' : '-100vw',
      zIndex: 20,
    }),
    animate: {
      x: 0,
      zIndex: 20,
      transition: {
        x: { type: 'tween', duration: 0.4, ease: [0.22, 1, 0.36, 1] },
      }
    },
    exit: (dir: number) => ({
      x: dir > 0 ? '-100vw' : '100vw',
      zIndex: 0,
      // 나가는 페이지를 absolute로 변경해 아래로 밀리지 않고 겹치면서 이동하게 함
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      width: '100%',
      transition: {
        x: { type: 'tween', duration: 0.4, ease: [0.22, 1, 0.36, 1] },
      }
    })
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-gray-100">
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={pathname}
          custom={direction}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="w-full bg-gray-100 min-h-screen"
        >
          <FrozenRoute>{children}</FrozenRoute>
        </motion.div>
      </AnimatePresence>

      {/* Pagination Dots (스와이프 넛지) - 3번 화면 전용 */}
      {currentIndex === 2 && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 z-50 pointer-events-none bg-black/10 px-3 py-1.5 rounded-full backdrop-blur-md shadow-sm">
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                currentIndex === idx ? 'bg-gray-800 w-4' : 'bg-gray-500 w-1.5 opacity-60'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
