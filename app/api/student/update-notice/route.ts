import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import {
    addScheduledNotice,
    cancelScheduledNotice,
    getScheduledNotices,
    processDueScheduledNotices
} from '@/lib/scheduledNotice';

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

// GET: 예정된 예약 공지 확인 및 도달한 예약 공지 자동 처리
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const student_id = searchParams.get('student_id');

        // 예약 시간이 지난 공지 자동 배포 처리
        await processDueScheduledNotices(supabase);

        let scheduledNotices: any[] = [];
        if (student_id) {
            const { data: student } = await supabase
                .from('students')
                .select('grade, class, number, name')
                .eq('student_id', student_id)
                .single();

            const isMaster = student && student.grade === 3 && student.class === 3 && student.number === 17 && student.name === '홍길동';
            if (isMaster) {
                const allList = await getScheduledNotices(supabase);
                scheduledNotices = allList.filter(item => item.status === 'pending');
            }
        }

        return NextResponse.json({ success: true, scheduled_notices: scheduledNotices });
    } catch (error: any) {
        console.error('GET update-notice error:', error);
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            student_id,
            action,
            scheduled_id,
            target_student_id,
            new_notice_text,
            send_push = true,
            is_scheduled = false,
            scheduled_at
        } = body;

        // 학생 ID 확인
        if (!student_id) {
            return NextResponse.json(
                { error: '학생 인증 정보가 필요합니다.' },
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

        // 1. 예약 취소 액션
        if (action === 'cancel_schedule') {
            if (!scheduled_id) {
                return NextResponse.json({ error: '취소할 예약 ID가 필요합니다.' }, { status: 400 });
            }
            await cancelScheduledNotice(supabase, scheduled_id);
            return NextResponse.json({ success: true, message: '공지 예약이 성공적으로 취소되었습니다.' });
        }

        // 2. 신규 공지 등록 (공통 유효성 검사)
        if (typeof new_notice_text !== 'string' || !target_student_id) {
            return NextResponse.json(
                { error: '대상 학생 및 텍스트 내용이 필요합니다.' },
                { status: 400 }
            );
        }

        // 2-A. 예약 게시 처리
        if (is_scheduled) {
            if (!scheduled_at) {
                return NextResponse.json({ error: '예약 일시를 지정해주세요.' }, { status: 400 });
            }
            const scheduledTime = new Date(scheduled_at).getTime();
            if (isNaN(scheduledTime) || scheduledTime <= Date.now()) {
                return NextResponse.json({ error: '예약 시간은 현재 시간 이후여야 합니다.' }, { status: 400 });
            }

            const item = await addScheduledNotice(supabase, {
                creator_id: student_id,
                scheduled_at: new Date(scheduled_at).toISOString(),
                target_student_id,
                notice_text: new_notice_text,
                send_push
            });

            return NextResponse.json({
                success: true,
                is_scheduled: true,
                scheduled_notice: item,
                message: '공지가 성공적으로 예약되었습니다.'
            });
        }

        // 2-B. 즉시 게시 처리 (기존 로직 유지)
        let pushTargetQuery: any = null;
        let pushTitle = '📢 알림';
        let cleanPushBody = new_notice_text.replace(/\n?__ROOM_PUBLIC:(true|false)__/, '').trim();
        let pushBody = cleanPushBody.length > 30 ? cleanPushBody.substring(0, 30) + '...' : cleanPushBody;

        if (target_student_id === 'all') {
            // 1. 전체 공지 업데이트
            const { error: sysError } = await supabase
                .from('system_settings')
                .update({ setting_value: new_notice_text })
                .eq('setting_key', 'student_notice');
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
            const targetNumericId = String(target_student_id).match(/^\d+/)?.[0];
            const targetSearchIds = Array.from(new Set([String(target_student_id), targetNumericId].filter(Boolean) as string[]));

            pushTargetQuery = supabase.from('push_subscriptions').select('*').in('student_id', targetSearchIds);
            pushTitle = '📝 [개별 공지] 홍지관 안내문';
        }

        // 알림 푸시 전송 (send_push 가 true 일 때만 발송)
        let pushStats = { sent: 0, failed: 0, expired: 0 };
        if (send_push && pushTargetQuery && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
            const { data: subs, error: subError } = await pushTargetQuery;
            if (!subError && subs && subs.length > 0) {
                const payload = JSON.stringify({
                    title: pushTitle,
                    body: pushBody,
                    url: '/student'
                });

                const chunkSize = 35;
                const expiredIds: string[] = [];
                let successCount = 0;
                let failedCount = 0;

                for (let i = 0; i < subs.length; i += chunkSize) {
                    const chunk = subs.slice(i, i + chunkSize);
                    const results = await Promise.allSettled(
                        chunk.map(async (sub: any) => {
                            const subscription = typeof sub.subscription_json === 'string'
                                ? JSON.parse(sub.subscription_json)
                                : sub.subscription_json;
                            return webpush.sendNotification(subscription, payload, {
                                headers: { 'Urgency': 'high' }
                            });
                        })
                    );

                    results.forEach((res, idx) => {
                        if (res.status === 'fulfilled') {
                            successCount++;
                        } else {
                            failedCount++;
                            const err: any = res.reason;
                            if (err && (err.statusCode === 410 || err.statusCode === 404 || err.statusCode === 401 || err.statusCode === 403)) {
                                if (chunk[idx]?.id) {
                                    expiredIds.push(chunk[idx].id);
                                }
                            }
                        }
                    });
                }

                // 만료된 토큰 일괄 삭제 정리 (1회 배치 쿼리)
                if (expiredIds.length > 0) {
                    try {
                        await supabase.from('push_subscriptions').delete().in('id', expiredIds);
                        console.log(`[Push Notice] Cleaned up ${expiredIds.length} expired subscriptions.`);
                    } catch (cleanupErr) {
                        console.error('[Push Notice] Cleanup error:', cleanupErr);
                    }
                }

                pushStats = { sent: successCount, failed: failedCount, expired: expiredIds.length };
                console.log(`[Push Notice] Broadcast finished: ${successCount} sent, ${failedCount} failed (${expiredIds.length} expired removed).`);
            }
        }

        // 기존 대기중 예약 공지 도달 여부 점검
        await processDueScheduledNotices(supabase);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Unexpected error:', error);
        return NextResponse.json(
            { error: '서버 내부 오류 발생' },
            { status: 500 }
        );
    }
}
