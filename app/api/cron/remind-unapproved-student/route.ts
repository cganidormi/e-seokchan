import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export async function GET(request: Request) {
    return handleRemindUnapprovedStudent();
}

export async function POST(request: Request) {
    return handleRemindUnapprovedStudent();
}

async function handleRemindUnapprovedStudent() {
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
        const nowMs = now.getTime();
        const nowStr = now.toISOString();
        // Fetch requests starting within next 12 mins or already started (not ended)
        const in12MinsStr = new Date(nowMs + 12 * 60 * 1000).toISOString();

        // 1. Query pending leave requests
        const { data: pendingRequests, error: reqError } = await supabase
            .from('leave_requests')
            .select('id, leave_type, student_id, start_time, end_time, status')
            .eq('status', '신청')
            .lte('start_time', in12MinsStr)
            .gt('end_time', nowStr);

        if (reqError) {
            console.error('[Cron Student Unapproved] Fetch error:', reqError);
            return NextResponse.json({ error: reqError.message }, { status: 500 });
        }

        if (!pendingRequests || pendingRequests.length === 0) {
            return NextResponse.json({ success: true, processed: 0, message: 'No unapproved student alerts needed' });
        }

        const todayStr = nowStr.split('T')[0];
        let processedCount = 0;

        for (const req of pendingRequests) {
            const startTimeMs = new Date(req.start_time).getTime();
            const diffMs = startTimeMs - nowMs; // positive if starting in future, negative if already started

            // Determine trigger type:
            // 1. 10m warning: starts in 0 to 10.5 minutes (diffMs between 0 and 10.5 mins)
            // 2. Start time alert: started already or starting in <= 0 mins (diffMs <= 0)
            const triggersToProcess: { type: '10m' | 'start'; logKey: string; title: string; body: string }[] = [];

            if (diffMs > 0 && diffMs <= 10.5 * 60 * 1000) {
                triggersToProcess.push({
                    type: '10m',
                    logKey: `unapproved_student_10m_${req.id}`,
                    title: '⚠️ [미승인 이석 경고]',
                    body: `[${req.leave_type}] 10분 후 시작되는 이석이 아직 승인되지 않았습니다. 승인 확인 후 이석하세요!`
                });
            } else if (diffMs <= 0) {
                triggersToProcess.push({
                    type: 'start',
                    logKey: `unapproved_student_start_${req.id}`,
                    title: '🚨 [이석 미승인 안내]',
                    body: `[${req.leave_type}] 이석 시작 시간이 되었지만 아직 승인되지 않았습니다. 승인 전 이석은 금지됩니다!`
                });
            }

            if (triggersToProcess.length === 0) continue;

            // Fetch co-applicants for this request
            const { data: coStudents } = await supabase
                .from('leave_request_students')
                .select('student_id')
                .eq('leave_request_id', req.id);

            const coIds = coStudents?.map(c => c.student_id) || [];
            const targetStudentIds = Array.from(new Set([req.student_id, ...coIds].filter(Boolean)));

            if (targetStudentIds.length === 0) continue;

            // Fetch push subscriptions for all target students
            const { data: studentSubs } = await supabase
                .from('push_subscriptions')
                .select('subscription_json')
                .in('student_id', targetStudentIds);

            for (const trigger of triggersToProcess) {
                // Check if already notified
                const { data: existingLog } = await supabase
                    .from('notification_logs')
                    .select('id')
                    .eq('notification_type', trigger.logKey)
                    .maybeSingle();

                if (existingLog) continue; // Already sent, skip

                let successCount = 0;

                if (studentSubs && studentSubs.length > 0 && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
                    const payload = JSON.stringify({
                        title: trigger.title,
                        body: trigger.body,
                        url: '/student'
                    });

                    const pushResults = await Promise.allSettled(
                        studentSubs.map(sub => {
                            const subscription = typeof sub.subscription_json === 'string'
                                ? JSON.parse(sub.subscription_json)
                                : sub.subscription_json;
                            return webpush.sendNotification(subscription, payload);
                        })
                    );

                    successCount = pushResults.filter(r => r.status === 'fulfilled').length;
                }

                // Log the sent notification to prevent duplication
                await supabase
                    .from('notification_logs')
                    .insert({
                        target_date: todayStr,
                        notification_type: trigger.logKey,
                        sent_count: successCount
                    });

                processedCount++;
            }
        }

        return NextResponse.json({ success: true, processed: processedCount });

    } catch (e: any) {
        console.error('[Cron Student Unapproved] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
