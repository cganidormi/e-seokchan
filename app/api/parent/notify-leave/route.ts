import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Admin permission is required for fetching all subscriptions
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@dormichan.com',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

export async function POST(request: Request) {
    try {
        const { studentId, studentName, leaveType, startTime, endTime } = await request.json();

        if (!studentId || !studentName || !leaveType) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Get the parent_token for the given student
        const { data: student, error: studentError } = await supabaseAdmin
            .from('students')
            .select('parent_token')
            .eq('student_id', studentId)
            .single();

        if (studentError || !student || !student.parent_token) {
            return NextResponse.json({ message: 'No parent token found for student' });
        }

        // 2. Fetch all parent subscriptions using the parent_token
        const { data: subs, error: subError } = await supabaseAdmin
            .from('push_subscriptions')
            .select('*')
            .eq('parent_token', student.parent_token);

        if (subError) {
            console.error('Fetch subs error:', subError);
            return NextResponse.json({ error: subError.message }, { status: 500 });
        }

        if (!subs || subs.length === 0) {
            return NextResponse.json({ message: 'No active parent subscriptions found' });
        }

        // 3. Prepare Notification Content
        const formattedStart = startTime ? new Date(startTime).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        const formattedEnd = endTime ? new Date(endTime).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        let periodText = '';
        if (formattedStart && formattedEnd) {
            periodText = ` (기간: ${formattedStart} ~ ${formattedEnd})`;
        }

        const payload = JSON.stringify({
            title: `📝 자녀 ${leaveType} 신청 알림`,
            body: `${studentName} 학생이 ${leaveType}을(를) 신청했습니다.${periodText}`,
            url: '/parent'
        });

        // 4. Send Notifications (Parallel)
        const sendPromises = subs.map(async (sub) => {
            try {
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

        return NextResponse.json({
            success: true,
            sent: successCount,
            total: subs.length
        });

    } catch (error: any) {
        console.error('Parent trigger API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
