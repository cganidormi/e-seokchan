import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Reuse existing web-push setup if possible, or import directly
// Since web-push might not be globally available, ensuring clean import.

export async function POST(request: Request) {
    try {
        const { studentId, teacherName } = await request.json();

        if (!studentId) {
            return NextResponse.json({ error: 'Student ID required' }, { status: 400 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // 1. Get Student's Push Subscription
        // The table is 'push_subscriptions', column 'student_id'
        const { data: subs, error } = await supabase
            .from('push_subscriptions')
            .select('subscription_json')
            .eq('student_id', studentId);

        if (error) throw error;

        if (!subs || subs.length === 0) {
            return NextResponse.json({ message: 'No metrics found for this student', status: 'no_subscription' }, { status: 200 });
        }

        // 2. Send Push
        const webpush = (await import('web-push')).default;

        webpush.setVapidDetails(
            process.env.VAPID_SUBJECT || 'mailto:admin@dormichan.com',
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
            process.env.VAPID_PRIVATE_KEY!
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

        return NextResponse.json({ success: true, count: successCount });

    } catch (error: any) {
        console.error('Summon Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
