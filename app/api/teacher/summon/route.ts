import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Reuse existing web-push setup if possible, or import directly
// Since web-push might not be globally available, ensuring clean import.

export async function POST(request: Request) {
    // --- Improved Error Handling & Logging ---
    try {
        const { studentId, teacherName } = await request.json();

        if (!studentId) {
            console.error('[API/Summon] Missing studentId');
            return NextResponse.json({ error: '학생 ID가 필요합니다.' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('[API/Summon] Missing Supabase Env Vars');
            return NextResponse.json({
                error: '서버 설정 오류: Supabase 키가 없습니다. (Vercel 환경변수 확인 필요)'
            }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Get Student's Push Subscription
        const { data: subs, error } = await supabase
            .from('push_subscriptions')
            .select('subscription_json')
            .eq('student_id', studentId);

        if (error) {
            console.error('[API/Summon] DB Error:', error);
            return NextResponse.json({ error: '데이터베이스 오류' }, { status: 500 });
        }

        if (!subs || subs.length === 0) {
            console.warn(`[API/Summon] No subscription found for student: ${studentId}`);
            return NextResponse.json({ error: '학생이 알림 권한을 허용하지 않았습니다.\n(앱 미설치 또는 알림 차단)' }, { status: 404 });
        }

        // 2. Check VAPID Keys
        if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
            console.error('[API/Summon] Missing VAPID Keys');
            return NextResponse.json({ error: '서버 알림 설정 오류 (VAPID Key Missing)' }, { status: 500 });
        }

        // 2.5 Retrieve Timetable & Holidays for Current Period Calculation
        const { data: timetable } = await supabase.from('timetable_entries').select('*');
        const { data: holidays } = await supabase.from('special_holidays').select('date');

        // Calculate Current Time (KST)
        const now = new Date();
        const kstOffset = 9 * 60; // KST +9
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const kstDate = new Date(utc + (3600000 * 9));

        const month = kstDate.getMonth() + 1;
        const date = kstDate.getDate();
        const day = kstDate.getDay(); // 0=Sun, 6=Sat
        const dateStr = kstDate.toISOString().split('T')[0];
        const hhmm = kstDate.getHours().toString().padStart(2, '0') + ':' + kstDate.getMinutes().toString().padStart(2, '0');

        let periodName = "";

        if (timetable) {
            const isWeekend = day === 0 || day === 6;
            const isHoliday = isWeekend || (holidays || []).some(h => h.date === dateStr);

            let typeFilter = 'weekday';
            if (isHoliday) {
                // Simple mapping for ease
                typeFilter = 'weekend';
            }

            // Find matching period
            const currentPeriod = timetable.find(t => {
                if (!t.day_type.includes(typeFilter)) return false;
                // Use simple string comparison for "HH:mm"
                return hhmm >= t.start_time.substring(0, 5) && hhmm <= t.end_time.substring(0, 5);
            });

            if (currentPeriod) {
                // Extract logic (Night 1 -> 야간 1교시, Day 8 -> 8교시)
                if (currentPeriod.day_type.includes('night')) {
                    const num = currentPeriod.description.replace(/[^0-9]/g, '');
                    periodName = `야간 ${num}교시`;
                } else {
                    const num = currentPeriod.description.replace(/[^0-9]/g, '');
                    periodName = `${num}교시`;
                }
            }
        }

        const timeString = `${month}월 ${date}일 ${periodName ? periodName : hhmm}`;
        const message = `현재시간은 ${timeString} 입니다. 이석을 신청하거나 학습실로 돌아오세요.`;

        // 3. Send Push
        const webpush = (await import('web-push')).default;

        webpush.setVapidDetails(
            process.env.VAPID_SUBJECT || 'mailto:admin@dormichan.com',
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );

        const payload = JSON.stringify({
            title: '📢 선생님 호출',
            body: `${teacherName} 선생님: "${message}"`,
            url: `/?summon=true&teacherName=${encodeURIComponent(teacherName)}&action=submit_leave&message=${encodeURIComponent(message)}`
        });

        const results = await Promise.allSettled(
            subs.map(sub => webpush.sendNotification(sub.subscription_json, payload))
        );

        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failedCount = results.length - successCount;

        if (successCount === 0) {
            console.error('[API/Summon] All push attempts failed:', results);
            return NextResponse.json({ error: '알림 전송 실패 (유효한 토큰이 없습니다.)' }, { status: 500 });
        }

        return NextResponse.json({ success: true, count: successCount, failed: failedCount });

    } catch (error: any) {
        console.error('[API/Summon] Critical Error:', error);
        return NextResponse.json({ error: `서버 오류: ${error.message}` }, { status: 500 });
    }
}
