import { NextResponse } from 'next/server';
import webpush from 'web-push';

// VAPID 설정 (lazy init)
const initWebPush = () => {
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@dormichan.com',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!
    );
};

export async function POST(request: Request) {
    try {
        initWebPush();
        const { subscription, message, title, badge } = await request.json();

        // 1. 구독 저장 요청인 경우 (message가 없음)
        if (!message) {
            // 실제로는 DB에 저장해야 하지만, 여기서는 성공 응답만 반환
            // (DB 저장은 클라이언트에서 Supabase로 직접 수행하거나, 여기서 수행)
            return NextResponse.json({ success: true, message: 'Subscription received (Backend)' });
        }

        // 2. 푸시 발송 요청인 경우
        const payload = JSON.stringify({
            title: title || '알림',
            body: message,
            url: '/', // 클릭 시 이동할 URL
            badge: badge // 앱 아이콘 숫자 표시
        });

        await webpush.sendNotification(subscription, payload);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Web Push Error:', error);
        return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
    }
}
