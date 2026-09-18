'use client';

import React, { useEffect } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface SwipeWrapperProps {
  children: React.ReactNode;
  prevPath?: string;
  nextPath?: string;
}

export default function SwipeWrapper({ children, prevPath, nextPath }: SwipeWrapperProps) {
  const router = useRouter();

  // 페이지 이동 전 다음/이전 페이지를 미리 백그라운드에서 로드하여 지연 없는 화면 전환 구현
  useEffect(() => {
    if (prevPath) router.prefetch(prevPath);
    if (nextPath) router.prefetch(nextPath);
  }, [prevPath, nextPath, router]);
  
  const x = useMotionValue(0);
  const SWIPE_THRESHOLD = 50;

  const handleDragEnd = (e: any, info: any) => {
    const swipeDistance = info.offset.x;
    const velocity = info.velocity.x;

    // 왼쪽으로 밀기 (스와이프 래프트 -> 다음 페이지)
    if ((swipeDistance < -SWIPE_THRESHOLD || velocity < -500) && nextPath) {
      x.set(0); // 즉시 원래 위치로 복귀시켜 전환 애니메이션과 충돌(화면 벌어짐) 방지
      router.push(nextPath);
    }
    // 오른쪽으로 밀기 (스와이프 라이트 -> 이전 페이지)
    else if ((swipeDistance > SWIPE_THRESHOLD || velocity > 500) && prevPath) {
      x.set(0);
      router.push(prevPath);
    }
  };

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={handleDragEnd}
      // 세로 스크롤은 유지하되 가로 터치는 드래그로 인식하도록 touch-pan-y 적용
      className="w-full min-h-screen touch-pan-y"
    >
      {children}
    </motion.div>
  );
}
