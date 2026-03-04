import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Supabase Service Role Key (Bypasses RLS)
const supabase = createClient(
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
        const { student_id, target_student_id, new_notice_text } = await request.json();

        // target_student_id는 'all' 이거나 특정 student_id (예: '3317홍길동')
        if (!student_id || typeof new_notice_text !== 'string' || !target_student_id) {
            return NextResponse.json(
                { error: '학생 인증 정보, 대상 학생, 텍스트 내용이 필요합니다.' },
                { status: 400 }
            );
        }

        // 권한 검증: 로그인한 학생이 3학년 3반 17번 홍길동인지 확인
        const { data: student, error: studentError } = await supabase
            .from('students')
            .select('grade, class, number, name')
            .eq('student_id', student_id)
            .single();

        if (studentError || !student) {
            return NextResponse.json(
                { error: '유효하지 않은 계정입니다.' },
                { status: 401 }
            );
        }

        if (
            student.grade !== 3 ||
            student.class !== 3 ||
            student.number !== 17 ||
            student.name !== '홍길동'
        ) {
            return NextResponse.json(
                { error: '전광판 내용을 수정할 권한이 없습니다.' },
                { status: 403 }
            );
        }

        let pushTargetQuery: any = null;
        let pushTitle = '📢 알림';
        let pushBody = new_notice_text.length > 30 ? new_notice_text.substring(0, 30) + '...' : new_notice_text;

        if (target_student_id === 'all') {
            // 1. 전체 공지 업데이트
            const { error: sysError } = await supabase.from('system_settings').upsert(
                {
                    setting_key: 'student_notice',
                    setting_value: new_notice_text,
                },
                { onConflict: 'setting_key' }
            );
            if (sysError) throw sysError;

            // 2. 모든 학생의 개별 공지 비우기 (초기화)
            const { error: clearError } = await supabase
                .from('students')
                .update({ personal_notice: null })
                .not('student_id', 'is', null);
            if (clearError) throw clearError;

            // 3. 푸시 알림 타겟: 모든 학생
            pushTargetQuery = supabase.from('push_subscriptions').select('*').not('student_id', 'is', null);
            pushTitle = '📢 [전체 공지] 홍지관 안내문';
        } else {
            // 1. 특정 학생의 개별 공지 업데이트
            const { error: updateError } = await supabase
                .from('students')
                .update({ personal_notice: new_notice_text })
                .eq('student_id', target_student_id);
            if (updateError) throw updateError;

            // 2. 푸시 알림 타겟: 특정 학생
            pushTargetQuery = supabase.from('push_subscriptions').select('*').eq('student_id', target_student_id);
            pushTitle = '📝 [개별 공지] 홍지관 안내문';
        }

        // 알림 푸시 전송 (백그라운드에서 지연되지 않도록 await)
        if (pushTargetQuery && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
            const { data: subs, error: subError } = await pushTargetQuery;
            if (!subError && subs && subs.length > 0) {
                const payload = JSON.stringify({
                    title: pushTitle,
                    body: pushBody,
                    url: '/student'
                });

                const pushPromises = subs.map(async (sub: any) => {
                    try {
                        const subscription = typeof sub.subscription_json === 'string'
                            ? JSON.parse(sub.subscription_json)
                            : sub.subscription_json;
                        await webpush.sendNotification(subscription, payload);
                    } catch (err: any) {
                        if (err.statusCode === 410 || err.statusCode === 404) {
                            // 만료된 구독 삭제
                            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
                        }
                    }
                });

                await Promise.allSettled(pushPromises);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Unexpected error:', error);
        return NextResponse.json(
            { error: '서버 내부 오류 발생' },
            { status: 500 }
        );
    }
}
