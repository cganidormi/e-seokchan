'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'react-hot-toast';
import InstallGuide from './components/InstallGuide';
import { IoShareOutline, IoAddOutline } from "react-icons/io5";

export default function Home() {
  const router = useRouter();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isChromeIOS, setIsChromeIOS] = useState(false);

  // 1. Session & Environment Check
  useEffect(() => {
    // 0. Extract & Persist Parent Token (CRITICAL for PWA)
    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('dormichan_parent_token', token);
    }

    // Check if running in standalone mode (PWA)
    const checkStandalone = () => {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as any).standalone ||
        document.referrer.includes('android-app://')
      );
    };

    const inStandalone = checkStandalone();
    setIsStandalone(inStandalone);

    // Detect iOS & Browser Type (More Robust)
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const iOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Detect Chrome on iOS: 'CriOS' is the key
    const isChrome = /CriOS/i.test(userAgent);
    if (isChrome) {
      setIsChromeIOS(true);
    }

    const hasSession =
      localStorage.getItem('dormichan_login_id') ||
      sessionStorage.getItem('dormichan_login_id') ||
      localStorage.getItem('dormichan_parent_token');

    if (inStandalone || hasSession) {
      performRedirect();
    } else {
      setIsLoading(false); // Show Landing Page
    }
  }, []);

  // ... (rest of code)

  return (
    // ... (rest of code)
    <div className="mb-8">
      {/* Logo Section: Safari Fix with Mask Image */}
      <div
        className="w-24 h-24 bg-white/20 rounded-[2rem] mx-auto flex items-center justify-center mb-6 shadow-inner backdrop-blur-sm border border-white/10 overflow-hidden isolate"
        style={{
          WebkitMaskImage: '-webkit-radial-gradient(white, black)', // Safari rounded corner fix
          maskImage: 'radial-gradient(white, black)'
        }}
      >
        <img src="/images/school_emblem.png" alt="강원과학고" className="w-full h-full object-cover drop-shadow-sm rounded-[2rem]" />
      </div>
      <h1 className="text-3xl font-extrabold text-white mb-2 tracking-wide drop-shadow-md">이석찬</h1>

      <p className="text-gray-200 font-medium">
        기숙사 생활의 모든 것<br />
        앱으로 더 편리하게 시작하세요
      </p>
    </div>

        {/* Action Section */ }
  <div className="space-y-4">
    {!isIOS ? (
      // Android / Desktop Button
      <div className="flex flex-col gap-4">
        <button
          onClick={handleInstallClick}
          className="w-full bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold py-4 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 text-lg border border-white/20"
        >
          {(deferredPrompt) ? '📲 앱 설치하고 시작하기' : '✨ 앱으로 시작하기'}
        </button>

        {!deferredPrompt && (
          <InstallGuide />
        )}
      </div>
    ) : (
      // iOS Guide Box
      <div className="bg-white/10 p-5 rounded-2xl text-left border border-white/20 backdrop-blur-md shadow-lg">
        <h3 className="font-bold text-white mb-4 text-center text-lg">
          📱 {isChromeIOS ? 'Chrome' : 'Safari'}에서 설치하기
        </h3>

        <div className="space-y-4 text-sm text-gray-100">
          {/* Step 1 */}
          <div className="flex items-start gap-4 p-3 bg-black/20 rounded-xl border border-white/5 hover:bg-black/30 transition-colors">
            <div className="bg-blue-500/20 p-2.5 rounded-lg shrink-0">
              <IoShareOutline className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="font-bold text-white mb-1">1. 공유 버튼 누르기</p>
              <p className="text-xs text-gray-300">
                {isChromeIOS ? '우측 상단에 있습니다.' : <>사파리 화면 하단(또는 상단)의 <br /><span className="text-blue-300 font-bold">공유 아이콘</span>을 찾아주세요.</>}
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-4 p-3 bg-black/20 rounded-xl border border-white/5 hover:bg-black/30 transition-colors">
            <div className="bg-gray-500/20 p-2.5 rounded-lg shrink-0">
              <IoAddOutline className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-bold text-white mb-1">2. 홈 화면에 추가</p>
              <p className="text-xs text-gray-300">
                메뉴를 아래로 내려서 <br />
                <span className="text-white font-bold">"홈 화면에 추가"</span>를 선택하세요.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-center gap-3 p-2 justify-center text-xs text-gray-400 mt-2">
            <span>마지막으로 우측 상단 <strong>[추가]</strong> 버튼 터치!</span>
          </div>
        </div>
      </div>
    )}
  </div>
      </div >
    </div >
  );
}

