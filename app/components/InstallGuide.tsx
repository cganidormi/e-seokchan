import { useState } from 'react';

export default function InstallGuide() {
    const [browser, setBrowser] = useState<'chrome' | 'edge'>('chrome');

    return (
        <div className="text-sm text-gray-500 bg-orange-50 p-4 rounded-xl border border-orange-100/50 text-left">
            <div className="flex items-center justify-center gap-2 mb-3 border-b border-orange-200 pb-2">
                <button
                    onClick={() => setBrowser('chrome')}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${browser === 'chrome'
                            ? 'bg-orange-500 text-white shadow-md'
                            : 'bg-white text-gray-500 hover:bg-orange-100'
                        }`}
                >
                    Chrome
                </button>
                <button
                    onClick={() => setBrowser('edge')}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${browser === 'edge'
                            ? 'bg-orange-500 text-white shadow-md'
                            : 'bg-white text-gray-500 hover:bg-orange-100'
                        }`}
                >
                    Edge
                </button>
            </div>

            {browser === 'chrome' ? (
                <>
                    <p className="mb-2 font-bold text-orange-800 text-center text-xs">
                        Chrome 브라우저 설치 방법
                    </p>
                    <ol className="space-y-2 list-decimal list-inside text-xs leading-relaxed">
                        <li>우측 상단 <strong>메뉴(⋮)</strong> 클릭</li>
                        <li><strong>'전송, 저장 및 공유'</strong> 메뉴 선택</li>
                        <li><strong>'페이지를 앱으로 설치'</strong> 클릭</li>
                        <li>바탕화면에 <strong>이석찬 아이콘</strong> 생성!</li>
                    </ol>
                </>
            ) : (
                <>
                    <p className="mb-2 font-bold text-orange-800 text-center text-xs">
                        Edge 브라우저 설치 방법
                    </p>
                    <ol className="space-y-2 list-decimal list-inside text-xs leading-relaxed">
                        <li>우측 상단 <strong>메뉴(⋯)</strong> 클릭</li>
                        <li><strong>'앱'</strong> 메뉴 선택 <span className="text-[10px] text-gray-400">(또는 기타 도구 &gt; 앱)</span></li>
                        <li><strong>'이 사이트를 앱으로 설치'</strong> 클릭</li>
                        <li>바탕화면에 <strong>이석찬 아이콘</strong> 생성!</li>
                    </ol>
                </>
            )}
        </div>
    );
}
