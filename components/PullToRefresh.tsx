'use client';

import { useState, useEffect, useRef } from 'react';

interface PullToRefreshProps {
    onRefresh: () => Promise<void>;
    children: React.ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
    const [startY, setStartY] = useState(0);
    const [currentY, setCurrentY] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    // 최소 당겨야 하는 거리 (픽셀)
    const PULL_THRESHOLD = 80;

    useEffect(() => {
        // 터치 이벤트 핸들러
        const handleTouchStart = (e: TouchEvent) => {
            if (window.scrollY === 0) {
                setStartY(e.touches[0].clientY);
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            const touchY = e.touches[0].clientY;
            const pullDistance = touchY - startY;

            // 이미 스크롤이 내려와있거나, 위로 올리는 제스처면 무시
            if (window.scrollY > 0 || pullDistance < 0 || startY === 0) {
                return;
            }

            // 약간의 저항감(0.5)을 주며 당겨짐
            if (pullDistance > 0) {
                // 기본 스크롤 막기 (오버스크롤 방지)
                if (e.cancelable) e.preventDefault();
                setCurrentY(pullDistance * 0.4);
            }
        };

        const handleTouchEnd = async () => {
            if (startY === 0) return;

            // 이미 새로고침 중이면 패스
            if (isRefreshing) {
                setStartY(0);
                return;
            }

            if (currentY > PULL_THRESHOLD) {
                setIsRefreshing(true);
                setCurrentY(60); // 로딩 위치로 고정 (콘텐츠가 60px 내려간 상태)

                try {
                    // Vibrate on Android (optional)
                    if (navigator.vibrate) navigator.vibrate(50);
                    await onRefresh();
                } finally {
                    setIsRefreshing(false);
                    setCurrentY(0);
                }
            } else {
                // 취소 (제자리로 복귀)
                setCurrentY(0);
            }
            setStartY(0);
        };

        const element = contentRef.current;
        if (!element) return;

        element.addEventListener('touchstart', handleTouchStart, { passive: true });
        element.addEventListener('touchmove', handleTouchMove, { passive: false });
        element.addEventListener('touchend', handleTouchEnd);

        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchmove', handleTouchMove);
            element.removeEventListener('touchend', handleTouchEnd);
        };
    }, [startY, currentY, onRefresh]);

    return (
        <div
            ref={contentRef}
            style={{ minHeight: '100vh' }}
        >
            {/* 로딩 인디케이터 (배경 뒤에 숨어있다가 내려오거나, 콘텐츠와 같이 내려옴) */}
            <div
                className="fixed top-0 left-0 right-0 flex justify-center items-center pointer-events-none z-0"
                style={{
                    height: '60px',
                    // 인디케이터는 콘텐츠가 내려가면 그 뒤에서 보이도록(혹은 같이 움직이도록) 설정
                    // 여기서는 심플하게 상단 고정하고 콘텐츠가 내려가서 보여주는 방식 or 콘텐츠 위에 오버레이
                    // Native 느낌을 위해: 인디케이터도 같이 내려오되 약간의 Parallax 또는 그냥 상단에 위치
                    marginTop: isRefreshing ? '10px' : '0px',
                    opacity: currentY > 0 || isRefreshing ? 1 : 0,
                    transition: 'opacity 0.2s',
                    transform: `translateY(${currentY > 0 ? (currentY * 0.5) : 0}px)` // 인디케이터도 약간 따라내려오게
                }}
            >
                <div className="bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-md border border-gray-100 flex items-center justify-center transition-transform duration-200"
                    style={{ transform: `rotate(${currentY * 2}deg)` }}
                >
                    {isRefreshing ? (
                        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <span className={`text-xl text-orange-500 transition-transform ${currentY > PULL_THRESHOLD ? 'rotate-180' : ''}`}>⬇️</span>
                    )}
                </div>
            </div>

            {/* 실제 콘텐츠 (당겨짐) */}
            <div
                style={{
                    transform: `translateY(${currentY}px)`,
                    transition: isRefreshing ? 'transform 0.2s' : (currentY === 0 ? 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none'),
                    // 터치 중엔 transition 없음 (즉각반응), 놓으면 부드럽게 복귀
                    position: 'relative',
                    zIndex: 1,
                    backgroundColor: 'transparent' // 배경이 투명해야 뒤에 인디케이터가... 아니, 인디케이터를 z-index 높여서 위에 띄우는게 더 모던함
                }}
            >
                {children}
            </div>
        </div>
    );
}
