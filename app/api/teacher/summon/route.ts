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

        // 1. Get Student's Push Subscription (Match both full student_id and numeric student_id)
        const numericId = String(studentId).match(/^\d+/)?.[0];
        const searchIds = Array.from(new Set([String(studentId), numericId].filter(Boolean) as string[]));

        const { data: subs, error } = await supabase
            .from('push_subscriptions')
            .select('id, subscription_json')
            .in('student_id', searchIds);

        if (error) {
            console.error('[API/Summon] DB Error:', error);
            return NextResponse.json({ error: '데이터베이스 오류' }, { status: 500 });
        }

        // 1.5 Retrieve Timetable & Holidays for Current Period Calculation
        const { data: timetable } = await supabase.from('timetable_entries').select('*');
        const { data: holidays } = await supabase.from('special_holidays').select('date');

        // Calculate Current Time (KST)
        const now = new Date();
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
                typeFilter = 'weekend';
            }

            const currentPeriod = timetable.find(t => {
                if (!t.day_type.includes(typeFilter)) return false;
                return hhmm >= t.start_time.substring(0, 5) && hhmm <= t.end_time.substring(0, 5);
            });

            if (currentPeriod) {
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
        const summonId = Date.now();
        const summonTimestamp = new Date().toISOString();

        // 1.8 Save summon to system_settings for Realtime & In-App guaranteed delivery
        try {
            const { data: existingSetting } = await supabase
                .from('system_settings')
                .select('setting_value')
                .eq('setting_key', 'student_summons')
                .maybeSingle();

            let summonMap: Record<string, any[]> = {};
            if (existingSetting?.setting_value) {
                try {
                    summonMap = JSON.parse(existingSetting.setting_value);
                } catch (e) {
                    summonMap = {};
                }
            }

            const cutoff = Date.now() - 12 * 60 * 60 * 1000;
            Object.keys(summonMap).forEach(k => {
                if (Array.isArray(summonMap[k])) {
                    summonMap[k] = summonMap[k].filter((item: any) => item && item.id > cutoff);
                    if (summonMap[k].length === 0) delete summonMap[k];
                } else {
                    delete summonMap[k];
                }
            });

            const key = String(studentId).trim();
            if (!summonMap[key]) summonMap[key] = [];
            summonMap[key].push({
                id: summonId,
                teacherName: teacherName || '담당',
                message,
                timestamp: summonTimestamp
            });

            await supabase.from('system_settings').upsert({
                setting_key: 'student_summons',
                setting_value: JSON.stringify(summonMap),
                updated_at: summonTimestamp
            }, { onConflict: 'setting_key' });
        } catch (dbSummonErr) {
            console.warn('[API/Summon] Realtime summon record warning:', dbSummonErr);
        }

        if (!subs || subs.length === 0) {
            console.warn(`[API/Summon] No subscription found for student: ${studentId} (searched: ${searchIds.join(', ')})`);
            return NextResponse.json({ error: '학생이 알림 권한을 허용하지 않았습니다.\n(앱 내 실시간 호출 창은 전송되었습니다)' }, { status: 404 });
        }

        // 2. Check VAPID Keys
        if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
            console.error('[API/Summon] Missing VAPID Keys');
            return NextResponse.json({ error: '서버 알림 설정 오류 (VAPID Key Missing)' }, { status: 500 });
        }

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
            url: `/?summon=true&teacherName=${encodeURIComponent(teacherName)}&action=submit_leave&message=${encodeURIComponent(message)}`,
            tag: 'student-summon',
            summonData: {
                id: summonId,
                teacherName: teacherName || '담당',
                message,
                timestamp: summonTimestamp
            }
        });

        const results = await Promise.allSettled(
            subs.map(sub => {
                const subscription = typeof sub.subscription_json === 'string'
                    ? JSON.parse(sub.subscription_json)
                    : sub.subscription_json;
                return webpush.sendNotification(subscription, payload, {
                    headers: {
                        'Urgency': 'high',
                        'TTL': '86400'
                    }
                });
            })
        );

        // 4. 만료된 구형 토큰(410 Gone, 404 Not Found) 및 VAPID 키 불일치(401 Unauthorized, 403 Forbidden) 자동 삭제 정리
        const expiredSubIds: string[] = [];
        results.forEach((r, idx) => {
            if (r.status === 'rejected') {
                const err: any = r.reason;
                if (err && (err.statusCode === 410 || err.statusCode === 404 || err.statusCode === 401 || err.statusCode === 403)) {
                    if (subs[idx]?.id) {
                        expiredSubIds.push(subs[idx].id);
                    }
                }
            }
        });

        if (expiredSubIds.length > 0) {
            try {
                const { error: delErr } = await supabase.from('push_subscriptions').delete().in('id', expiredSubIds);
                if (delErr) console.error('[API/Summon] Error deleting expired subs:', delErr);
                else console.log(`[API/Summon] Cleaned up ${expiredSubIds.length} expired subscriptions.`);
            } catch (cleanupErr: any) {
                console.error('[API/Summon] Cleanup error:', cleanupErr);
            }
        }

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
