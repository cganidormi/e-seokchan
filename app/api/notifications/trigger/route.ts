import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Admin permission is required for fetching all subscriptions and inserting logs
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@dormichan.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
);

export async function POST(request: Request) {
    try {
        const { date, type } = await request.json(); // e.g., date: '2024-03-10', type: 'period_start'

        if (!date || !type) {
            return NextResponse.json({ error: 'Missing date or type' }, { status: 400 });
        }

        // 1. Check if already sent
        const { data: logs, error: logError } = await supabaseAdmin
            .from('notification_logs')
            .select('*')
            .eq('target_date', date)
            .eq('notification_type', type)
            .single();

        // If query sends back a row, it means we already processed this.
        if (logs) {
            return NextResponse.json({ message: 'Already sent', logs });
        }

        // 2. Fetch all subscriptions
        const { data: subs, error: subError } = await supabaseAdmin
            .from('push_subscriptions')
            .select('*');

        if (subError) {
            console.error('Fetch subs error:', subError);
            return NextResponse.json({ error: subError.message }, { status: 500 });
        }

        if (!subs || subs.length === 0) {
            return NextResponse.json({ message: 'No subscriptions found' });
        }

        // 3. Prepare Message
        let title = '알림';
        let body = '';

        if (type === 'period_start') {
            title = '🏠 매주 귀가 신청 시작';
            body = '매주 귀가 신청 기간(10일~12일)이 시작되었습니다. 잊지 말고 신청해주세요!';
        } else if (type === 'period_end') {
            title = '⏰ 매주 귀가 신청 마감 임박';
            body = '오늘(12일)이 매주 귀가 신청 마감일입니다. 아직 신청하지 않았다면 서둘러주세요!';
        } else {
            return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }

        const payload = JSON.stringify({
            title,
            body,
            url: '/'
        });

        // 4. Send Notifications (Parallel)
        const sendPromises = subs.map(async (sub) => {
            try {
                // subscription_json is stored as JSONB in DB
                const subscription = typeof sub.subscription_json === 'string'
                    ? JSON.parse(sub.subscription_json)
                    : sub.subscription_json;

                await webpush.sendNotification(subscription, payload);
                return { success: true, id: sub.id };
            } catch (err: any) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    // Expired subscription - remove from DB
                    await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
                }
                return { success: false, id: sub.id, error: err };
            }
        });

        const results = await Promise.all(sendPromises);
        const successCount = results.filter(r => r.success).length;

        // 5. Log execution
        const { error: insertError } = await supabaseAdmin
            .from('notification_logs')
            .insert({
                target_date: date,
                notification_type: type,
                sent_count: successCount
            });

        if (insertError) {
            console.error('Log insert error:', insertError);
        }

        return NextResponse.json({
            success: true,
            sent: successCount,
            total: subs.length
        });

    } catch (error: any) {
        console.error('Trigger API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
