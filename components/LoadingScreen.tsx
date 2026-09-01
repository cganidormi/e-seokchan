'use client';

import React from 'react';

interface LoadingScreenProps {
    message?: string;
}

export default function LoadingScreen({ message }: LoadingScreenProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white overflow-hidden select-none">
            {/* Emblem Composite Container */}
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 flex items-center justify-center">
                {/* 1. Fixed Stationary Outer Text Ring ("강원과학고 1993") */}
                <img
                    src="/images/school_emblem_outer.png"
                    alt="강원과학고등학교 외곽 띠"
                    className="absolute inset-0 w-full h-full object-contain z-10 pointer-events-none"
                />

                {/* 2. Rotating Inner Symbol Graphics */}
                <img
                    src="/images/school_emblem_inner.png"
                    alt="강원과학고등학교 중앙 심볼"
                    className="absolute inset-0 w-full h-full object-contain z-0 animate-[spin_4s_linear_infinite]"
                />
            </div>
        </div>
    );
}
