'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'react-hot-toast';
import InstallGuide from './components/InstallGuide';

export default function Home() {
  const router = useRouter();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Session & Environment Check
  useEffect(() => {
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

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // If already in App Mode OR already logged in -> Redirect immediately
    // (We want to skip the landing page if they are already using the app or have a session)
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

  // 2. Capture Install Prompt (Android/Chrome)
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const performRedirect = () => {
    const loginId = localStorage.getItem('dormichan_login_id') || sessionStorage.getItem('dormichan_login_id');
    const role = localStorage.getItem('dormichan_role') || sessionStorage.getItem('dormichan_role');
    const parentToken = localStorage.getItem('dormichan_parent_token');

    if (loginId && role) {
      if (role === 'student') window.location.replace('/student');
      else if (role === 'teacher') window.location.replace('/teacher');
      else window.location.replace('/login');
    } else if (parentToken) {
      window.location.replace(`/parent?token=${parentToken}`);
    } else {
      window.location.replace('/login');
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      if (isIOS) {
        toast('하단의 공유 버튼을 눌러 홈 화면에 추가해주세요!', { icon: '👆' });
      } else {
        toast('브라우저 메뉴에서 "앱 설치"를 찾아보세요.');
      }
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 font-medium">이석찬으로 이동 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 to-yellow-400 flex items-center justify-center p-6">
      <Toaster />
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-8 text-center animate-fade-in-up">

        {/* Logo Section */}
        <div className="mb-8">
          <div className="w-24 h-24 bg-orange-100 rounded-[2rem] mx-auto flex items-center justify-center mb-6 shadow-inner">
            <span className="text-5xl">🏫</span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">이석찬</h1>
          <p className="text-gray-500 font-medium">
            기숙사 생활의 모든 것<br />
            앱으로 더 편리하게 시작하세요
          </p>
        </div>

        {/* Action Section */}
        <div className="space-y-4">
          {!isIOS ? (
            // Android / Desktop Button
            <div className="flex flex-col gap-4">
              <button
                onClick={handleInstallClick}
                className="w-full bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-orange-700 active:scale-95 transition-all flex items-center justify-center gap-2 text-lg"
              >
                {(deferredPrompt) ? '📲 앱 설치하고 시작하기' : '✨ 앱으로 시작하기'}
              </button>

              {!deferredPrompt && (
                <InstallGuide />
              )}
            </div>
          ) : (
            // iOS Guide Box
            <div className="bg-gray-50 p-4 rounded-2xl text-left border border-gray-100">
              <p className="font-bold text-gray-800 mb-3 text-center">📱 아이폰/아이패드 설치 방법</p>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-center gap-3">
                  <span className="bg-white p-2 rounded-lg shadow-sm">1</span>
                  <span>브라우저 상단 또는 하단 <strong>공유 버튼</strong><img src="/ios-share.svg" className="inline w-4 h-4 mx-1" alt="share" />터치</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="bg-white p-2 rounded-lg shadow-sm">2</span>
                  <span>메뉴에서 <strong>'홈 화면에 추가'</strong> 선택</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="bg-white p-2 rounded-lg shadow-sm">3</span>
                  <span>상단 <strong>'추가'</strong> 버튼 누르면 완료!</span>
                </div>
              </div>
            </div>
          )}

          {/* Fallback Link Removed for Mandatory PWA Install */}
        </div>
      </div>
    </div>
  );
}
