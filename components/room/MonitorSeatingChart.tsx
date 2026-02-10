"use client";

import { useEffect, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import clsx from "clsx";
import { supabase } from "@/supabaseClient";

// Room Layout Configuration (Same as Teacher Page)
const DEFAULT_LAYOUT: Record<number, { row: number; col: number }> = {
    // Top Row (06-10)
    6: { row: 1, col: 1 }, 7: { row: 1, col: 2 }, 8: { row: 1, col: 3 }, 9: { row: 1, col: 4 }, 10: { row: 1, col: 5 },
    // Left Column (05-01) -> Col 3
    5: { row: 2, col: 3 }, 4: { row: 3, col: 3 }, 3: { row: 4, col: 3 }, 2: { row: 5, col: 3 }, 1: { row: 6, col: 3 },
    // Right Column (11-15) -> Col 5
    11: { row: 2, col: 5 }, 12: { row: 3, col: 5 }, 13: { row: 4, col: 5 }, 14: { row: 5, col: 5 }, 15: { row: 6, col: 5 },
    // Bottom Area (Inner: 21-25, Outer: 16-20)
    21: { row: 7, col: 4 }, 16: { row: 7, col: 5 },
    22: { row: 8, col: 4 }, 17: { row: 8, col: 5 },
    23: { row: 9, col: 4 }, 18: { row: 9, col: 5 },
    24: { row: 10, col: 4 }, 19: { row: 10, col: 5 },
    25: { row: 11, col: 4 }, 20: { row: 11, col: 5 },
};

const FLOOR_1_LAYOUT: Record<number, { row: number; col: number }> = {
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].reduce((acc, idx) => ({ ...acc, [idx]: DEFAULT_LAYOUT[idx] }), {}),
    20: { row: 7, col: 4 }, 21: { row: 8, col: 4 }, 22: { row: 9, col: 4 }, 23: { row: 10, col: 4 }
};

const FLOOR_2_LAYOUT: Record<number, { row: number; col: number }> = {
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].reduce((acc, idx) => ({ ...acc, [idx]: DEFAULT_LAYOUT[idx] }), {}),
    21: { row: 12, col: 5 },
    22: { row: 7, col: 4 }, 23: { row: 8, col: 4 }, 24: { row: 9, col: 4 }, 25: { row: 10, col: 4 }, 26: { row: 11, col: 4 }, 27: { row: 12, col: 4 }
};

const FLOOR_4_LAYOUT: Record<number, { row: number; col: number }> = {
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].reduce((acc, idx) => ({ ...acc, [idx]: DEFAULT_LAYOUT[idx] }), {}),
    20: { row: 7, col: 4 }, 21: { row: 8, col: 4 }, 22: { row: 9, col: 4 }, 23: { row: 10, col: 4 }, 24: { row: 11, col: 4 }, 25: { row: 12, col: 4 }
};

const FLOORS = [1, 2, 3, 4];
const getAllRooms = () => {
    const rooms: number[] = [];
    FLOORS.forEach(floor => {
        let layout = DEFAULT_LAYOUT;
        if (floor === 1) layout = FLOOR_1_LAYOUT;
        if (floor === 2) layout = FLOOR_2_LAYOUT;
        if (floor === 4) layout = FLOOR_4_LAYOUT;
        Object.keys(layout).forEach(idx => rooms.push(floor * 100 + Number(idx)));
    });
    return rooms;
};
const ALL_ROOMS = getAllRooms();

const isWeeklyHomeTime = (date: Date) => {
    const day = date.getDay();
    const hour = date.getHours();
    const minute = date.getMinutes();
    if (day === 5) return hour >= 17;
    if (day === 6) return true;
    if (day === 0) {
        if (hour < 18) return true;
        if (hour === 18 && minute <= 50) return true;
        return false;
    }
    return false;
};

export default function MonitorSeatingChart({ floor }: { floor: number }) {
    const [roomStatus, setRoomStatus] = useState<Record<number, any>>({});
    const [loading, setLoading] = useState(true);

    const fetchStatus = async () => {
        try {
            const { data: students } = await supabase.from('students').select('*');

            const studentsByRoom: Record<number, any[]> = {};
            students?.forEach((s: any) => {
                const room = s.room_number || s.room;
                if (room) {
                    if (!studentsByRoom[room]) studentsByRoom[room] = [];
                    studentsByRoom[room].push(s);
                }
            });

            const now = new Date();
            const nowStr = now.toISOString();

            const { data: leaveData } = await supabase
                .from('leave_requests')
                .select('student_id, status, leave_type, start_time, end_time, leave_request_students(student_id)')
                .eq('status', '승인')
                .eq('leave_type', '외박')
                .lte('start_time', nowStr)
                .gte('end_time', nowStr);

            const outStatus = new Map<string, '외출' | '외박'>();
            leaveData?.forEach((req: any) => {
                const type = req.leave_type;
                if (req.student_id) outStatus.set(req.student_id, type);
                req.leave_request_students?.forEach((s: any) => outStatus.set(s.student_id, type));
            });

            // Real-time listener for 'leave_requests'
            // Ideally we should subscribe here, but for simplicity let's just fetch first. 
            // Parent component can trigger re-fetch or we add subscription here.

            const initialStatus: any = {};
            ALL_ROOMS.forEach((roomNum) => {
                const roomStudents = studentsByRoom[roomNum] || [];
                initialStatus[roomNum] = {
                    left: {
                        status: roomStudents[0] && outStatus.has(roomStudents[0].student_id) ? 'out' : 'in',
                        leaveType: roomStudents[0] ? outStatus.get(roomStudents[0].student_id) : undefined,
                        name: roomStudents[0]?.name || '',
                        student_id: roomStudents[0]?.student_id || '',
                        isWeekend: roomStudents[0]?.weekend || false
                    },
                    right: {
                        status: roomStudents[1] && outStatus.has(roomStudents[1].student_id) ? 'out' : 'in',
                        leaveType: roomStudents[1] ? outStatus.get(roomStudents[1].student_id) : undefined,
                        name: roomStudents[1]?.name || '',
                        student_id: roomStudents[1]?.student_id || '',
                        isWeekend: roomStudents[1]?.weekend || false
                    }
                };
            });

            // Load overrides
            const savedConfig = localStorage.getItem('dormichan_assignments');
            if (savedConfig) {
                const parsed = JSON.parse(savedConfig);
                ALL_ROOMS.forEach(roomNum => {
                    const savedRoom = parsed[roomNum];
                    if (savedRoom) {
                        if (!initialStatus[roomNum]) initialStatus[roomNum] = { left: { status: 'in' }, right: { status: 'in' } };

                        ['left', 'right'].forEach((pos: string) => {
                            const p = pos as 'left' | 'right';
                            if (savedRoom[p]) {
                                initialStatus[roomNum][p].name = savedRoom[p].name;
                                initialStatus[roomNum][p].student_id = savedRoom[p].student_id;
                                initialStatus[roomNum][p].status = savedRoom[p].student_id && outStatus.has(savedRoom[p].student_id) ? 'out' : 'in';
                                initialStatus[roomNum][p].leaveType = savedRoom[p].student_id ? outStatus.get(savedRoom[p].student_id) : undefined;
                                // Restore weekend status
                                const student = students?.find((s: any) => s.student_id === savedRoom[p].student_id);
                                initialStatus[roomNum][p].isWeekend = student?.weekend || false;
                            }
                        });
                    }
                });
            }

            setRoomStatus(initialStatus);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();

        // Subscribe to changes
        const channel = supabase
            .channel('monitor_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
                fetchStatus();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps


    if (loading) return <div className="text-white text-center mt-20">Loading...</div>;

    return (
        <div className="w-full h-full flex items-center justify-center bg-[#121212]">
            <TransformWrapper
                initialScale={0.6}
                minScale={0.4}
                maxScale={2}
                centerOnInit={true}
                wheel={{ step: 0.1 }}
            >
                <TransformComponent
                    wrapperStyle={{ width: "100%", height: "100%" }}
                    contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                    <div className="grid grid-cols-5 gap-4 min-w-[1400px] p-10 select-none">
                        {Object.keys(floor === 1 ? FLOOR_1_LAYOUT : (floor === 2 ? FLOOR_2_LAYOUT : (floor === 4 ? FLOOR_4_LAYOUT : DEFAULT_LAYOUT))).map((key) => {
                            const idx = Number(key);
                            const roomNum = floor * 100 + idx;
                            const roomData = roomStatus[roomNum] || { left: { status: 'in', name: '' }, right: { status: 'in', name: '' } };
                            const layout = floor === 1 ? FLOOR_1_LAYOUT : (floor === 2 ? FLOOR_2_LAYOUT : (floor === 4 ? FLOOR_4_LAYOUT : DEFAULT_LAYOUT));
                            const pos = layout[idx];

                            const isSideBySide = idx >= 6 && idx <= 10;
                            const isReverseVertical = (idx >= 1 && idx <= 5) || (floor !== 1 && floor !== 2 && floor !== 4 && idx >= 21 && idx <= 25);

                            return (
                                <div
                                    key={roomNum}
                                    style={{ gridColumn: pos?.col, gridRow: pos?.row }}
                                    className={clsx(
                                        "relative overflow-hidden rounded-2xl bg-[#1c1c1e] border border-white/10 p-2 flex flex-col gap-2 shadow-2xl transition-all",
                                        isSideBySide ? "h-32 w-full" : "h-52 w-3/5 min-w-[120px] mx-auto"
                                    )}
                                >
                                    <div className="flex justify-center items-center px-1 shrink-0">
                                        <span className={clsx("font-black tracking-tight text-white/50", isSideBySide ? "text-xs" : "text-sm")}>
                                            {roomNum}
                                        </span>
                                    </div>

                                    <div className={clsx("flex flex-1 gap-2 h-full", isSideBySide ? "flex-row" : (isReverseVertical ? "flex-col-reverse" : "flex-col"))}>
                                        {['left', 'right'].map((position) => {
                                            const p = position as 'left' | 'right';
                                            const data = roomData[p];
                                            const isOut = data.status === 'out';
                                            const isWeekend = isWeeklyHomeTime(new Date()) && data.isWeekend;
                                            const isEmpty = !data.name;

                                            return (
                                                <div
                                                    key={p}
                                                    className={clsx(
                                                        "relative flex-1 rounded-xl border flex flex-col items-center justify-center transition-all duration-300",
                                                        isOut
                                                            ? (data.leaveType === '외출'
                                                                ? "bg-green-600/20 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.2)]"
                                                                : "bg-purple-600/20 border-purple-500/50 shadow-[0_0_15px_rgba(147,51,234,0.2)]")
                                                            : (
                                                                !isEmpty && !isWeekend
                                                                    ? "bg-white border-white shadow-[0_0_20px_rgba(255,255,255,0.4)] z-10"
                                                                    : "bg-[#2c2c2e] border-gray-700/50"
                                                            )
                                                    )}
                                                >
                                                    <span className={clsx(
                                                        "text-lg font-black truncate max-w-full px-2 z-20",
                                                        isOut ? "text-white" : (!isEmpty && !isWeekend ? "text-black" : "text-gray-500")
                                                    )}>
                                                        {data.name || '-'}
                                                    </span>
                                                    {isOut && (
                                                        <span className={clsx("text-xs font-bold mt-1 px-2 py-0.5 rounded-full", data.leaveType === '외출' ? "bg-green-500 text-black" : "bg-purple-500 text-black")}>
                                                            {data.leaveType}
                                                        </span>
                                                    )}
                                                    {isWeekend && (
                                                        <span className="text-xs font-bold text-gray-500 mt-1">매주귀가</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </TransformComponent>
            </TransformWrapper>
        </div>
    );
}
