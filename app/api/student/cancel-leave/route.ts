import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { requestId, studentId } = await request.json();

        // Fallback to Anon Key if Service Role is missing (prevents crash, relies on RLS)
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const isServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
        console.log(`[API] Using key type: ${isServiceRole ? 'SERVICE_ROLE' : 'ANON'}`);

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            supabaseKey
        );

        // 1. 요청 정보 조회
        const { data: req, error: fetchError } = await supabase
            .from('leave_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (fetchError || !req) {
            return NextResponse.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 });
        }

        // 권한 확인: 본인 요청인지 (또는 관리자/교사 등 - 여기선 학생 로직이므로 본인 확인)
        if (req.student_id !== studentId) {
            return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
        }

        // 2. 시간 확인 (종료 시간 이후 취소 불가 - 진행 중인 건은 취소 가능하도록 변경)
        const now = new Date();
        const endTime = new Date(req.end_time);

        // 이미 끝난 건에 대해서만 취소 제한
        if (now > endTime) {
            return NextResponse.json({ error: '종료 시간이 지나 취소할 수 없습니다.' }, { status: 400 });
        }

        const status = req.status;

        // 3. 상태별 로직 처리
        if (status === '신청' || status === '학부모승인대기' || status === '승인전' || req.leave_type === '컴이석') {
            // [Case 1] 승인 전 (단순 삭제)
            // 1. 관계 테이블 먼저 삭제 (FK 제약조건 방지)
            await supabase
                .from('leave_request_students')
                .delete()
                .eq('leave_request_id', requestId);

            // 2. 본 요청 삭제
            const { error: deleteError } = await supabase
                .from('leave_requests')
                .delete()
                .eq('id', requestId);

            if (deleteError) throw deleteError;
            return NextResponse.json({ message: '삭제되었습니다.', action: 'delete' });

        } else if (status === '학부모승인' || status === '승인') {
            // [Case 2 & 3] 승인 후 (취소 처리 + 알림)

            // 3-1. 상태 업데이트 (취소)
            const { error: updateError } = await supabase
                .from('leave_requests')
                .update({ status: '취소' })
                .eq('id', requestId);

            if (updateError) throw updateError;

            // 3-2. 알림 대상 수집
            try {
                // 학부모 알림 (필수) - 외출/외박인 경우만 (컴이석/이석/자리비움 제외)
                // 교사 알림 (최종 승인 상태였을 경우 필수)

                const notifications = [];

                // A. 학부모 알림 (외출/외박 한정)
                if (req.leave_type === '외출' || req.leave_type === '외박') {
                    // 학생 정보 조회 (parent_token 찾기 위해)
                    const { data: studentData } = await supabase
                        .from('students')
                        .select('parent_token, name, grade, class')
                        .eq('student_id', studentId)
                        .single();

                    if (studentData && studentData.parent_token) {
                        // 학부모 구독 정보 조회
                        const { data: parentSubs } = await supabase
                            .from('push_subscriptions')
                            .select('subscription_json')
                            .eq('parent_token', studentData.parent_token);

                        if (parentSubs && parentSubs.length > 0) {
                            notifications.push({
                                recipients: parentSubs.map(s => s.subscription_json),
                                title: '학생 귀가 취소 알림',
                                message: `${studentData.grade}학년 ${studentData.class}반 ${studentData.name} 학생이 [${req.leave_type}] 승인 건을 취소했습니다.`,
                            });
                        }
                    }
                }

                // B. 교사 알림 (최종 승인 상태였던 경우만)
                if (status === '승인' && req.teacher_id) {
                    const { data: studentData } = await supabase
                        .from('students')
                        .select('name')
                        .eq('student_id', studentId)
                        .single();

                    const { data: teacherSubs } = await supabase
                        .from('push_subscriptions')
                        .select('subscription_json')
                        .eq('teacher_id', req.teacher_id);

                    if (teacherSubs && teacherSubs.length > 0) {
                        notifications.push({
                            recipients: teacherSubs.map(s => s.subscription_json),
                            title: '외출/외박 취소 알림',
                            message: `${studentData?.name} 학생이 최종 승인된 [${req.leave_type}] 건을 취소했습니다.`,
                        });
                    }
                }

                // 3-3. 알림 발송 (비동기 처리 - 직접 전송)
                if (notifications.length > 0) {
                    // Dynamic import to prevent top-level crashes if module is missing/broken
                    const webpush = (await import('web-push')).default;

                    webpush.setVapidDetails(
                        process.env.VAPID_SUBJECT || 'mailto:admin@dormichan.com',
                        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
                        process.env.VAPID_PRIVATE_KEY!
                    );

                    await Promise.all(notifications.map(async (note) => {
                        return Promise.all(note.recipients.map(sub => {
                            const payload = JSON.stringify({
                                title: note.title,
                                body: note.message,
                                url: '/'
                            });
                            return webpush.sendNotification(sub, payload).catch(e => console.error('Push Error', e));
                        }));
                    }));
                }

            } catch (notiError) {
                console.error('Notification Error (Non-blocking):', notiError);
                // 알림 실패해도 취소 처리는 성공으로 간주
            }

            return NextResponse.json({ message: '취소되었습니다.', action: 'cancel' });
        }

        return NextResponse.json({ message: '처리할 수 없는 상태입니다.' }, { status: 400 });

    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
    }
}
