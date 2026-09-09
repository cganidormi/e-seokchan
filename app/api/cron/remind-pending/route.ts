import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export async function GET(request: Request) {
    return handleRemindPending();
}

export async function POST(request: Request) {
    return handleRemindPending();
}

async function handleRemindPending() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceKey) {
            return NextResponse.json({ error: 'Supabase Env Missing' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, serviceKey);

        if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
            webpush.setVapidDetails(
                process.env.VAPID_SUBJECT || 'mailto:admin@dormichan.com',
                process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
                process.env.VAPID_PRIVATE_KEY
            );
        }

        const now = new Date();
        const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
        const nowStr = now.toISOString();

        // 1. Fetch pending requests created >= 15 minutes ago, not expired
        const { data: pendingRequests, error: reqError } = await supabase
            .from('leave_requests')
            .select('id, leave_type, student_id, teacher_id, created_at, status')
            .eq('status', '신청')
            .lte('created_at', fifteenMinsAgo)
            .gt('end_time', nowStr)
            .not('teacher_id', 'is', null);

        if (reqError) {
            console.error('[Cron Remind] Request fetch error:', reqError);
            return NextResponse.json({ error: reqError.message }, { status: 500 });
        }

        if (!pendingRequests || pendingRequests.length === 0) {
            return NextResponse.json({ success: true, processed: 0, message: 'No 15-min pending requests' });
        }

        // Fetch student names for display
        const studentIds = Array.from(new Set(pendingRequests.map(r => r.student_id).filter(Boolean)));
        let studentMap = new Map<string, string>();

        if (studentIds.length > 0) {
            const { data: studentsData } = await supabase
                .from('students')
                .select('student_id, name')
                .in('student_id', studentIds);

            studentsData?.forEach(s => studentMap.set(s.student_id, s.name));
        }

        const todayStr = now.toISOString().split('T')[0];
        let processedCount = 0;

        for (const req of pendingRequests) {
            const notificationType = `15min_reminder_leave_${req.id}`;

            // 2. Check if already reminded for this request
            const { data: existingLog } = await supabase
                .from('notification_logs')
                .select('id')
                .eq('notification_type', notificationType)
                .maybeSingle();

            if (existingLog) {
                // Already reminded, skip
                continue;
            }

            // 3. Fetch teacher's push subscription
            const { data: teacherSubs } = await supabase
                .from('push_subscriptions')
                .select('subscription_json')
                .eq('teacher_id', req.teacher_id);

            const studentName = studentMap.get(req.student_id) || req.student_id;
            const pushTitle = '⏰ [미처리 이석 알림]';
            const pushBody = `[${req.leave_type}] ${studentName} 학생의 이석 신청이 15분째 대기 중입니다. 확인해 주세요.`;

            let successCount = 0;

            if (teacherSubs && teacherSubs.length > 0 && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
                const payload = JSON.stringify({
                    title: pushTitle,
                    body: pushBody,
                    url: '/teacher'
                });

                const pushResults = await Promise.allSettled(
                    teacherSubs.map(sub => {
                        const subscription = typeof sub.subscription_json === 'string'
                            ? JSON.parse(sub.subscription_json)
                            : sub.subscription_json;
                        return webpush.sendNotification(subscription, payload);
                    })
                );

                successCount = pushResults.filter(r => r.status === 'fulfilled').length;
            }

            // 4. Record log to ensure it's sent only ONCE per request
            await supabase
                .from('notification_logs')
                .insert({
                    target_date: todayStr,
                    notification_type: notificationType,
                    sent_count: successCount
                });

            processedCount++;
        }

        return NextResponse.json({ success: true, processed: processedCount });

    } catch (e: any) {
        console.error('[Cron Remind] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
