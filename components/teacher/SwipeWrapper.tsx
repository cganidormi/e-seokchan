'use client';

import React, { useEffect, useRef } from 'react';
import { motion, useMotionValue, useDragControls } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface SwipeWrapperProps {
  children: React.ReactNode;
  prevPath?: string;
  nextPath?: string;
  topBottomOnly?: boolean;
}

export default function SwipeWrapper({ children, prevPath, nextPath, topBottomOnly = false }: SwipeWrapperProps) {
  const router = useRouter();
  const dragControls = useDragControls();

  // 페이지 이동 전 다음/이전 페이지를 미리 백그라운드에서 로드하여 지연 없는 화면 전환 구현
  useEffect(() => {
    if (prevPath) router.prefetch(prevPath);
    if (nextPath) router.prefetch(nextPath);
  }, [prevPath, nextPath, router]);
  
  const x = useMotionValue(0);
  const SWIPE_THRESHOLD = 50;
  const isDraggingAllowed = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!topBottomOnly) return;

    const y = e.clientY;
    const windowHeight = window.innerHeight;

    // 상단 (약 150px 또는 높이의 20% 이내) 또는 하단 (약 130px 또는 높이의 18% 이내) 영역인지 체크
    const topThreshold = Math.max(150, windowHeight * 0.20);
    const bottomThreshold = windowHeight - Math.max(130, windowHeight * 0.18);

    if (y <= topThreshold || y >= bottomThreshold) {
      isDraggingAllowed.current = true;
      dragControls.start(e);
    } else {
      isDraggingAllowed.current = false;
    }
  };

  const handleDragEnd = (e: any, info: any) => {
    if (topBottomOnly && !isDraggingAllowed.current) {
      x.set(0);
      return;
    }

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
    } else {
      x.set(0);
    }
  };

  return (
    <motion.div
      drag="x"
      dragListener={!topBottomOnly}
      dragControls={dragControls}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onPointerDown={handlePointerDown}
      onDragEnd={handleDragEnd}
      style={{ x }}
      // 세로 스크롤은 유지하되 가로 터치는 드래그로 인식하도록 touch-pan-y 적용
      className="w-full min-h-screen touch-pan-y"
    >
      {children}
    </motion.div>
  );
}

