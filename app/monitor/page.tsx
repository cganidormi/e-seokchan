"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StudyRoomMonitor } from "@/components/room/StudyRoomMonitor";

export default function MonitorPage() {
    const router = useRouter();
    const [currentFloor, setCurrentFloor] = useState(3);
    const [currentTime, setCurrentTime] = useState("");
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        // Check auth
        const role = localStorage.getItem("dormichan_role");
        if (role !== "monitor") {
            router.replace("/login");
        }

        // Clock
        const timer = setInterval(() => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }, 1000);
        setCurrentTime(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

        return () => clearInterval(timer);
    }, [router]);

    if (!isClient) return null;

    return (
        <div className="h-screen w-screen overflow-hidden bg-[#121212] flex flex-col">
            {/* Top Bar */}
            <div className="flex-none h-16 bg-[#1c1c1e] border-b border-white/10 flex items-center justify-between px-6 shadow-xl z-50">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600 tracking-tighter">
                        DormiMonitor
                    </h1>
                    <span className="px-3 py-1 rounded-full bg-white/10 text-white/70 text-sm font-bold border border-white/5">
                        제{currentFloor}학습실
                    </span>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-4xl font-mono font-bold text-gray-200 tracking-widest tabular-nums">
                        {currentTime}
                    </div>

                    <div className="w-px h-8 bg-white/10 mx-2"></div>

                    <div className="flex gap-2">
                        {[1, 2, 3, 4].map(f => (
                            <button
                                key={f}
                                onClick={() => setCurrentFloor(f)}
                                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${currentFloor === f ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/40' : 'bg-[#2c2c2e] text-gray-400 hover:bg-[#3a3a3c]'}`}
                            >
                                {f}실
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 relative">
                <StudyRoomMonitor roomId={currentFloor} />
            </div>
        </div>
    );
}
