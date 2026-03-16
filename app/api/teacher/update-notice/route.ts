import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Supabase Service Role Key (Bypasses RLS)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// VAPID Setup
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@dormichan.com',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

export async function POST(request: Request) {
    try {
        const { parent_token, new_notice_text, send_push } = await request.json();

        if (!parent_token || typeof new_notice_text !== 'string') {
            return NextResponse.json(
                { error: '토큰과 새로운 공지 내용이 필요합니다.' },
                { status: 400 }
            );
        }

        // 1. 토큰 소유자 권한 검증: 3학년 3반 17번 홍길동인지 확인! (이게 전광판 마스터 키)
        const { data: student, error: studentError } = await supabase
            .from('students')
            .select('grade, class, number, name')
            .eq('parent_token', parent_token)
            .single();

        if (studentError || !student) {
            return NextResponse.json(
                { error: '유효하지 않은 학부모 토큰입니다.' },
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

        // 2. 권한 확인 완료, system_settings 테이블 업데이트 (upsert)
        const { error } = await supabase.from('system_settings').upsert(
            {
                setting_key: 'parent_notice',
                setting_value: new_notice_text,
            },
            { onConflict: 'setting_key' }
        );

        if (error) {
            console.error('Notice update error:', error);
            return NextResponse.json(
                { error: '데이터베이스 업데이트 중 오류가 발생했습니다.', details: error.message },
                { status: 500 }
            );
        }

        // 3. 선택적 푸시 알림 발송 (send_push가 true일 때만)
        if (send_push && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
            // 모든 학부모(parent_token이 있는 구독정보)를 대상으로 조회
            const { data: subs, error: subError } = await supabase
                .from('push_subscriptions')
                .select('*')
                .not('parent_token', 'is', null);

            if (!subError && subs && subs.length > 0) {
                const payload = JSON.stringify({
                    title: '📢 [학부모 공지] 안내 말씀',
                    body: new_notice_text.length > 50 ? new_notice_text.substring(0, 50) + '...' : new_notice_text,
                    url: '/parent'
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

                // 비동기로 발송 (완료까지 기다림)
                await Promise.allSettled(pushPromises);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Unexpected error:', error);
        return NextResponse.json(
            { error: '서버 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
