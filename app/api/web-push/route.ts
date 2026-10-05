import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// VAPID 설정 (lazy init)
const initWebPush = () => {
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@dormichan.com',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!
    );
};

export async function POST(request: Request) {
    let subEndpoint: string | null = null;
    try {
        initWebPush();
        const { subscription, message, title, badge } = await request.json();

        // 1. 구독 저장 요청인 경우 (message가 없음)
        if (!message) {
            return NextResponse.json({ success: true, message: 'Subscription received (Backend)' });
        }

        subEndpoint = subscription?.endpoint || null;

        // 2. 푸시 발송 요청인 경우
        const payload = JSON.stringify({
            title: title || '알림',
            body: message,
            url: '/', // 클릭 시 이동할 URL
            badge: badge // 앱 아이콘 숫자 표시
        });

        await webpush.sendNotification(subscription, payload, {
            headers: {
                'Urgency': 'high',
                'TTL': '86400' // 24시간 동안 절전 모드 단말에도 도달 보장
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Web Push Error:', error);

        // 만료(410/404) 또는 VAPID 키 불일치(401/403) 발생 시 DB에서 죽은 토큰 자동 삭제
        const statusCode = error?.statusCode;
        if (subEndpoint && (statusCode === 401 || statusCode === 403 || statusCode === 404 || statusCode === 410)) {
            try {
                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
                const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
                if (supabaseUrl && supabaseServiceKey) {
                    const supabase = createClient(supabaseUrl, supabaseServiceKey);
                    const { data: rows } = await supabase.from('push_subscriptions').select('id, subscription_json');
                    const match = rows?.find((r: any) => {
                        const ep = typeof r.subscription_json === 'string'
                            ? JSON.parse(r.subscription_json)?.endpoint
                            : r.subscription_json?.endpoint;
                        return ep === subEndpoint;
                    });
                    if (match?.id) {
                        await supabase.from('push_subscriptions').delete().eq('id', match.id);
                        console.log(`[Web Push API] Cleaned up obsolete subscription: ${match.id} (Status ${statusCode})`);
                    }
                }
            } catch (cleanupErr) {
                console.error('[Web Push API] Cleanup error:', cleanupErr);
            }
        }

        return NextResponse.json({ error: 'Failed to send notification', statusCode }, { status: 500 });
    }
}

