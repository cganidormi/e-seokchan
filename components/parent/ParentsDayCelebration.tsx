'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

interface Props {
    type?: 'parent' | 'student' | 'teacher';
}

export default function AnniversaryBanner({ type = 'parent' }: Props) {
    const [isVisible, setIsVisible] = useState(false);
    const [eventMode, setEventMode] = useState<'parents' | 'teachers'>('parents');

    useEffect(() => {
        const now = new Date();
        const month = now.getMonth(); // 4 = 5월
        const date = now.getDate();
        
        // 어버이날 기간: 5/7 ~ 5/8
        const isParentsDay = month === 4 && (date === 7 || date === 8);
        // 스승의 날 기간: 5/14 ~ 5/15
        const isTeachersDay = month === 4 && (date === 14 || date === 15);

        if (isParentsDay) {
            setEventMode('parents');
            setIsVisible(true);
        } else if (isTeachersDay) {
            // 스승의 날 배너는 학생과 교사 페이지에만 노출
            if (type === 'student' || type === 'teacher') {
                setEventMode('teachers');
                setIsVisible(true);
            }
        }
    }, [type]);

    if (!isVisible) return null;

    const isStudent = type === 'student';
    const isTeacher = type === 'teacher';
    const isParentsEvent = eventMode === 'parents';

    // 메시지 구성 로직
    let title = "";
    let content = null;

    if (isParentsEvent) {
        title = isStudent ? "어버이날, 감사의 마음을 전하세요 🌹" : "어버이날 감사합니다 🌹";
        content = isStudent ? (
            <p>부모님의 사랑을 기리며, 오늘 하루<br />따뜻한 감사 전화 한 통 드려보는 건 어떨까요?</p>
        ) : (
            <p>부모님의 깊은 사랑에 감사드리며,<br />가정에 늘 행복과 평안이 가득하시길 기원합니다.
            </p>
        );
    } else {
        // 스승의 날 메시지
        title = "스승의 날, 감사합니다 💐";
        content = isTeacher ? (
            <p>학생들을 향한 선생님의 헌신과 사랑에 깊이 감사드립니다.<br />오늘 하루 선생님의 마음도 따뜻한 행복으로 가득하시길 바랍니다.</p>
        ) : isStudent ? (
            <p>스승의 날을 맞아 선생님께 감사의 마음을 표현해 보세요.<br />작은 인사가 선생님께는 큰 힘이 됩니다.</p>
        ) : (
            <p>아이들을 바른 길로 이끌어 주시는 선생님들께 감사드립니다.<br />학교와 선생님을 신뢰하며 함께하겠습니다.</p>
        );
    }

    return (
        <>
            {/* 꽃가루 효과 */}
            <div className="fixed inset-0 pointer-events-none z-[50] overflow-hidden">
                {[...Array(15)].map((_, i) => (
                    <motion.div
                        key={i}
                        initial={{ top: -20, left: `${Math.random() * 100}%`, rotate: 0, opacity: 0.8 }}
                        animate={{ top: '110%', left: `${(Math.random() * 100)}%`, rotate: 360, opacity: 0 }}
                        transition={{ duration: Math.random() * 5 + 5, repeat: Infinity, delay: Math.random() * 10, ease: "linear" }}
                        className="absolute w-2 h-2 rounded-full"
                        style={{ backgroundColor: isParentsEvent ? ['#FFB7B2', '#FF6B6B', '#FFD1DC'][Math.floor(Math.random() * 3)] : ['#A7D3A6', '#FFFFFF', '#FDFD96'][Math.floor(Math.random() * 3)], filter: 'blur(0.5px)' }}
                    />
                ))}
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md mx-auto mb-3 px-4 pt-2"
            >
                <div className={`w-full rounded-2xl p-3.5 shadow-md border relative overflow-hidden transition-all duration-300 ${isParentsEvent ? 'bg-rose-600 border-rose-500 shadow-rose-500/20' : 'bg-[#2d8a4e] border-[#3ba65f] shadow-green-700/20'}`}>
                    {/* Background Decor */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/10 to-transparent rounded-bl-full opacity-30 pointer-events-none"></div>

                    <div className="relative z-10 flex flex-col gap-2">
                        <div className="flex flex-col">
                            {isParentsEvent && (
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-7 h-7 bg-white/20 rounded-lg overflow-hidden flex items-center justify-center p-1 shrink-0">
                                        <img 
                                            src="/parents_day_carnation.png" 
                                            alt="🌹" 
                                            className="w-full h-full object-contain"
                                            onError={(e) => { (e.target as any).src = "https://cdn-icons-png.flaticon.com/512/3209/3209930.png"; }}
                                        />
                                    </div>
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-white/70 leading-none">
                                        Happy Parents' Day
                                    </span>
                                </div>
                            )}
                            {!isParentsEvent && (
                                <span className="text-[9px] font-bold uppercase tracking-wider text-white/60 leading-none mb-1">
                                    Happy Teacher's Day
                                </span>
                            )}
                            <h3 className="text-base font-bold text-white leading-tight">
                                {title}
                            </h3>
                        </div>

                        <div className="text-sm p-2.5 rounded-xl border bg-white/10 border-white/20 text-white leading-relaxed font-bold">
                            {content}
                        </div>
                    </div>
                </div>
            </motion.div>
        </>
    );
}
