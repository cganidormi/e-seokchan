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

        // 3. Send Push
        const webpush = (await import('web-push')).default;

        webpush.setVapidDetails(
            process.env.VAPID_SUBJECT || 'mailto:admin@dormichan.com',
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );

        const payload = JSON.stringify({
            title: '📢 선생님 호출',
            message: `${teacherName} 선생님께서 호출하셨습니다.\n즉시 이석증을 작성하거나 선생님께 찾아가세요.`,
            url: '/' // Open app home
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
