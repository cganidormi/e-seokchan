'use client';

import { useState, useEffect } from 'react';

interface PWAInstallPromptProps {
    role?: 'parent' | 'student' | 'teacher';
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({ role = 'student' }) => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const [showIOSGuide, setShowIOSGuide] = useState(false);

    useEffect(() => {
        // 1. Android/Chrome Install Prompt
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallPrompt(true);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // 2. iOS Detection
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

        if (isIOS && !isStandalone) {
            // Show guide after a delay
            setTimeout(() => setShowIOSGuide(true), 3000);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setShowInstallPrompt(false);
        }
        setDeferredPrompt(null);
    };

    if (!showInstallPrompt && !showIOSGuide) return null;

    return (
        <>
            {/* Android/Desktop Install Banner */}
            {showInstallPrompt && (
                <div className="fixed bottom-4 left-4 right-4 z-50">
                    <div className="bg-indigo-600 text-white p-4 rounded-xl shadow-lg flex items-center justify-between animate-fade-in-down">
                        <div>
                            <p className="font-bold">
                                {role === 'parent' ? '앱으로 더 편하게 확인하세요!' : '앱으로 설치해서 사용하세요!'}
                            </p>
                            <p className="text-xs text-indigo-200">
                                {role === 'parent' ? '설치하면 홈 화면에서 바로 접속 가능' : '자동 로그인 & 알림 기능 지원'}
                            </p>
                        </div>
                        <button
                            onClick={handleInstallClick}
                            className="bg-white text-indigo-600 px-4 py-2 rounded-lg text-sm font-bold shadow-sm active:scale-95 transition-transform"
                        >
                            설치하기
                        </button>
                    </div>
                </div>
            )}

            {/* iOS Install Guide Popup */}
            {showIOSGuide && (
                <div className="fixed bottom-0 left-0 right-0 bg-white p-6 rounded-t-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.1)] z-50 animate-slide-up-fade border-t border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">홈 화면에 추가하기</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                아이폰에서는 앱처럼 설치하여 더 편리하게 사용할 수 있습니다.
                            </p>
                        </div>
                        <button onClick={() => setShowIOSGuide(false)} className="text-gray-400 font-bold p-2 text-xl">&times;</button>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg">
                                {/* Use simple emoji or img if available */}
                                <img src="/ios-share.svg" alt="공유" className="w-5 h-5 text-blue-500" onError={(e) => e.currentTarget.style.display = 'none'} />
                                <span className={!document.querySelector('img[src="/ios-share.svg"]') ? "text-xl" : "hidden"}>📤</span>
                            </div>
                            <p className="text-sm font-medium text-gray-700">
                                1. 하단의 <span className="text-blue-500 font-bold">공유 버튼</span>을 누르세요.
                            </p>
                        </div>
                        <div className="w-px h-6 bg-gray-200 ml-5"></div>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg">
                                <span className="text-xl">➕</span>
                            </div>
                            <p className="text-sm font-medium text-gray-700">
                                2. 메뉴에서 <span className="font-bold">'홈 화면에 추가'</span>를 찾아 선택하세요.
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => setShowIOSGuide(false)}
                            className="w-full bg-gray-100 text-gray-600 font-bold py-3 rounded-xl"
                        >
                            닫기
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
