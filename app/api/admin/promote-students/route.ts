import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminRequest } from '@/lib/adminAuth';

interface PromotionEntry {
    newGrade: number;
    newClass: number;
    newNumber: number;
    name: string;
    weekend: boolean;
    /** 매칭된 기존 학생의 student_id (진급생인 경우 존재, 신입생/전입생인 경우 null) */
    matchedOldStudentId: string | null;
}

interface PromotionRequestBody {
    dryRun?: boolean;
    confirmText?: string;
    entries: PromotionEntry[];
    options?: {
        resetSeats?: boolean;
        resetRooms?: boolean;
        resetLeaves?: boolean;
    };
}

// 학부모 고유 토큰 생성 (대문자 2자리 + 숫자 4자리)
const generateShortToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const num1 = Math.floor(Math.random() * 10);
    const num2 = Math.floor(Math.random() * 10);
    const num3 = Math.floor(Math.random() * 10);
    const num4 = Math.floor(Math.random() * 10);
    const char1 = chars.charAt(Math.floor(Math.random() * chars.length));
    const char2 = chars.charAt(Math.floor(Math.random() * chars.length));
    return `${char1}${char2}${num1}${num2}${num3}${num4}`;
};

// 학생 고유 비밀번호(토큰) 생성 (숫자 4자리 + 영문 소문자 2자리)
const generateStudentPassword = () => {
    const num = Math.floor(1000 + Math.random() * 9000).toString();
    const letters = Array.from({ length: 2 }, () =>
        String.fromCharCode(97 + Math.floor(Math.random() * 26))
    ).join('');
    return num + letters;
};

export async function POST(request: Request) {
    try {
        const authResult = await verifyAdminRequest(request);
        if (!authResult.authorized) {
            return authResult.errorResponse!;
        }

        const body: PromotionRequestBody = await request.json();
        const {
            dryRun = true,
            confirmText = '',
            entries = [],
            options = { resetSeats: true, resetRooms: true, resetLeaves: false }
        } = body;

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

        if (!supabaseUrl || !serviceKey) {
            return NextResponse.json(
                { error: '서버 환경 변수(SUPABASE_SERVICE_ROLE_KEY)가 설정되지 않았습니다.' },
                { status: 500 }
            );
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceKey);

        // 1. 기존 전체 학생, 인증 정보, 푸시 구독 정보 로드 (읽기 전용 조회)
        const [
            { data: existingStudents, error: stuErr },
            { data: existingAuths, error: authErr },
            { data: existingSubs }
        ] = await Promise.all([
            supabaseAdmin.from('students').select('*'),
            supabaseAdmin.from('students_auth').select('*'),
            supabaseAdmin.from('push_subscriptions').select('*')
        ]);

        if (stuErr || authErr) {
            return NextResponse.json(
                { error: '기존 학생 데이터를 불러오지 못했습니다.', details: stuErr?.message || authErr?.message },
                { status: 500 }
            );
        }

        const oldStudentMap = new Map<string, any>();
        (existingStudents || []).forEach((s: any) => {
            if (s.student_id) oldStudentMap.set(s.student_id, s);
        });

        const oldAuthMap = new Map<string, any>();
        (existingAuths || []).forEach((a: any) => {
            if (a.student_id) oldAuthMap.set(a.student_id, a);
        });

        const validEntries = entries.filter(e => e.name && e.name.trim().length > 0);

        // 2. 진급 매칭 및 신규 생성 데이터 구성
        const toNewStudentId = (g: number, c: number, n: number, name: string) =>
            `${g}${c}${String(n).padStart(2, '0')}${name.trim()}`;

        const promotedList: any[] = [];
        const newCreatedList: any[] = [];
        const matchedOldIds = new Set<string>();

        for (const entry of validEntries) {
            const cleanName = entry.name.trim();
            const newStudentId = toNewStudentId(entry.newGrade, entry.newClass, entry.newNumber, cleanName);
            const oldStudent = entry.matchedOldStudentId ? oldStudentMap.get(entry.matchedOldStudentId) : null;
            const oldAuth = entry.matchedOldStudentId ? oldAuthMap.get(entry.matchedOldStudentId) : null;

            if (oldStudent && entry.matchedOldStudentId) {
                matchedOldIds.add(entry.matchedOldStudentId);
                const preservedToken = oldStudent.parent_token || generateShortToken();
                const preservedPassword = oldAuth?.temp_password || generateStudentPassword();
                const preservedMustChange = oldAuth ? !!oldAuth.must_change_password : true;
                const isCustomPassword = preservedPassword.startsWith('$2a$') || preservedPassword.startsWith('$2b$') || !preservedMustChange;

                promotedList.push({
                    old_student_id: entry.matchedOldStudentId,
                    old_grade: oldStudent.grade,
                    old_class: oldStudent.class,
                    old_number: oldStudent.number,
                    student_id: newStudentId,
                    grade: entry.newGrade,
                    class: entry.newClass,
                    number: entry.newNumber,
                    name: cleanName,
                    weekend: entry.weekend,
                    parent_token: preservedToken,
                    temp_password: preservedPassword,
                    must_change_password: preservedMustChange,
                    is_custom_password: isCustomPassword,
                    room_number: options.resetRooms ? null : (oldStudent.room_number || null),
                    bed_position: options.resetRooms ? null : (oldStudent.bed_position || null)
                });
            } else {
                const newToken = generateShortToken();
                const newStudentPw = generateStudentPassword();
                newCreatedList.push({
                    student_id: newStudentId,
                    grade: entry.newGrade,
                    class: entry.newClass,
                    number: entry.newNumber,
                    name: cleanName,
                    weekend: entry.weekend,
                    parent_token: newToken,
                    temp_password: newStudentPw,
                    must_change_password: true,
                    room_number: null,
                    bed_position: null
                });
            }
        }

        const isMasterAccount = (s: any) =>
            s.student_id === '3317홍길동' || s.student_id === '3318이순신';

        // 마스터 테스트 계정(3317홍길동, 3318이순신)이 기존 DB에 있고 새 명단에서 해당 번호가 비어있다면 자동 보존
        for (const masterStu of (existingStudents || []).filter(isMasterAccount)) {
            const slotTaken = validEntries.some(
                e => e.newGrade === masterStu.grade && e.newClass === masterStu.class && e.newNumber === masterStu.number
            );
            if (!slotTaken && !matchedOldIds.has(masterStu.student_id)) {
                const masterAuth = oldAuthMap.get(masterStu.student_id);
                matchedOldIds.add(masterStu.student_id);
                promotedList.push({
                    old_student_id: masterStu.student_id,
                    old_grade: masterStu.grade,
                    old_class: masterStu.class,
                    old_number: masterStu.number,
                    student_id: masterStu.student_id,
                    grade: masterStu.grade,
                    class: masterStu.class,
                    number: masterStu.number,
                    name: masterStu.name,
                    weekend: !!masterStu.weekend,
                    parent_token: masterStu.parent_token || generateShortToken(),
                    temp_password: masterAuth?.temp_password || generateStudentPassword(),
                    must_change_password: masterAuth ? !!masterAuth.must_change_password : false,
                    is_custom_password: true,
                    room_number: masterStu.room_number || null,
                    bed_position: masterStu.bed_position || null
                });
            }
        }

        const graduatingGrade3 = (existingStudents || []).filter(
            (s: any) => s.grade === 3 && !isMasterAccount(s)
        );
        const unmatchedGrade1And2 = (existingStudents || []).filter(
            (s: any) => (s.grade === 1 || s.grade === 2) && s.student_id && !matchedOldIds.has(s.student_id)
        );

        // 푸시 구독 승계 건수 계산
        const preservedPushCount = (existingSubs || []).filter((sub: any) =>
            (sub.student_id && matchedOldIds.has(sub.student_id)) ||
            (sub.parent_token && promotedList.some(p => p.parent_token === sub.parent_token))
        ).length;

        const summary = {
            dryRun,
            graduatingCount: graduatingGrade3.length,
            promotedGrade2To3Count: promotedList.filter(p => p.grade === 3).length,
            promotedGrade1To2Count: promotedList.filter(p => p.grade === 2).length,
            preservedCustomPasswordCount: promotedList.filter(p => p.is_custom_password).length,
            preservedParentTokenCount: promotedList.length,
            preservedPushSubscriptionCount: preservedPushCount,
            newFreshmanCount: newCreatedList.filter(n => n.grade === 1).length,
            newTransferCount: newCreatedList.filter(n => n.grade !== 1).length,
            unmatchedExistingCount: unmatchedGrade1And2.length,
            promotedPreview: promotedList.map(p => ({
                old_student_id: p.old_student_id,
                student_id: p.student_id,
                grade: p.grade,
                class: p.class,
                number: p.number,
                name: p.name,
                parent_token: p.parent_token,
                temp_password: (p.temp_password?.startsWith('$2a$') || p.temp_password?.startsWith('$2b$'))
                    ? '본인 설정 비번 유지'
                    : p.temp_password,
                password_status: (p.temp_password?.startsWith('$2a$') || p.temp_password?.startsWith('$2b$') || !p.must_change_password)
                    ? '본인 설정 비밀번호 그대로 유지'
                    : `미변경 고유비번(${p.temp_password}) 유지`
            })),
            newCreatedPreview: newCreatedList.map(n => ({
                student_id: n.student_id,
                grade: n.grade,
                class: n.class,
                number: n.number,
                name: n.name,
                parent_token: n.parent_token,
                temp_password: n.temp_password
            })),
            unmatchedPreview: unmatchedGrade1And2.map((u: any) => ({
                student_id: u.student_id,
                grade: u.grade,
                class: u.class,
                number: u.number,
                name: u.name
            }))
        };

        // ============================================================
        // 시뮬레이션 모드(dryRun === true)면 DB를 절대 건드리지 않고 즉시 반환!
        // ============================================================
        if (dryRun) {
            return NextResponse.json({
                success: true,
                mode: 'simulation',
                message: '시뮬레이션(모의 테스트) 완료 — 실제 데이터베이스는 변경되지 않았습니다.',
                summary
            });
        }

        // ============================================================
        // 실제 DB 반영 모드 (이중 검증)
        // ============================================================
        if (confirmText !== '새학기진급실행') {
            return NextResponse.json(
                { error: '안전 확인 문구("새학기진급실행")가 일치하지 않아 실행이 취소되었습니다.' },
                { status: 400 }
            );
        }

        // 1. 푸시 구독 백업 (ON DELETE CASCADE로 인한 유실 방지)
        const oldToNewIdMap = new Map<string, string>();
        promotedList.forEach(p => {
            oldToNewIdMap.set(p.old_student_id, p.student_id);
        });
        const validParentTokens = new Set<string>(promotedList.map(p => p.parent_token));

        const subsToRestore = (existingSubs || [])
            .filter((sub: any) =>
                (sub.student_id && oldToNewIdMap.has(sub.student_id)) ||
                (sub.parent_token && validParentTokens.has(sub.parent_token))
            )
            .map((sub: any) => ({
                student_id: sub.student_id ? (oldToNewIdMap.get(sub.student_id) || null) : null,
                parent_token: sub.parent_token || null,
                subscription_json: sub.subscription_json,
                device_type: sub.device_type,
                created_at: sub.created_at,
                last_used_at: sub.last_used_at
            }));

        // 2. 옵션에 따른 학기 초기화 (좌석 배정, 이석 기록 등)
        if (options.resetSeats) {
            await supabaseAdmin.from('seat_assignments').delete().neq('id', -1);
        } else {
            // 최소한 3학년 졸업생 및 미매칭 학생의 좌석 배정은 해제
            const idsToRemove = [
                ...graduatingGrade3.map((s: any) => s.student_id),
                ...unmatchedGrade1And2.map((s: any) => s.student_id)
            ].filter(Boolean);
            if (idsToRemove.length > 0) {
                await supabaseAdmin.from('seat_assignments').delete().in('student_id', idsToRemove);
            }
        }

        if (options.resetLeaves) {
            await supabaseAdmin.from('leave_requests').delete().neq('id', -1);
        } else {
            // 3학년 졸업생 이석 기록 정리
            const gradIds = graduatingGrade3.map((s: any) => s.student_id).filter(Boolean);
            if (gradIds.length > 0) {
                await supabaseAdmin.from('leave_requests').delete().in('student_id', gradIds);
            }
        }

        // 3. 기존 students 및 students_auth 전체 정리 후 새학기 명단 일괄 반영
        await supabaseAdmin.from('monthly_return_applications').delete().neq('student_id', '');
        await supabaseAdmin.from('students_auth').delete().neq('student_id', '특이사항');
        await supabaseAdmin.from('students').delete().neq('student_id', '');

        // 4. 새학기 students 일괄 삽입 (진급생 + 신입생/전입생)
        const allNewStudentsRows = [
            ...promotedList.map(p => ({
                student_id: p.student_id,
                grade: p.grade,
                class: p.class,
                number: p.number,
                name: p.name,
                weekend: p.weekend,
                parent_token: p.parent_token,
                room_number: p.room_number,
                bed_position: p.bed_position
            })),
            ...newCreatedList.map(n => ({
                student_id: n.student_id,
                grade: n.grade,
                class: n.class,
                number: n.number,
                name: n.name,
                weekend: n.weekend,
                parent_token: n.parent_token,
                room_number: null,
                bed_position: null
            }))
        ];

        if (allNewStudentsRows.length > 0) {
            const { error: insertStuErr } = await supabaseAdmin
                .from('students')
                .upsert(allNewStudentsRows, { onConflict: 'student_id' });

            if (insertStuErr) {
                throw new Error(`학생 테이블 저장 실패: ${insertStuErr.message}`);
            }
        }

        // 5. 새학기 students_auth 일괄 삽입 (진급생은 기존 고유 비밀번호 유지, 신입생은 새 고유 비밀번호 발급)
        const allNewAuthRows = [
            ...promotedList.map(p => ({
                student_id: p.student_id,
                username: p.student_id,
                temp_password: p.temp_password,
                must_change_password: p.must_change_password
            })),
            ...newCreatedList.map(n => ({
                student_id: n.student_id,
                username: n.student_id,
                temp_password: n.temp_password,
                must_change_password: true
            }))
        ];

        if (allNewAuthRows.length > 0) {
            const { error: insertAuthErr } = await supabaseAdmin
                .from('students_auth')
                .upsert(allNewAuthRows, { onConflict: 'student_id' });

            if (insertAuthErr) {
                throw new Error(`학생 인증 테이블 저장 실패: ${insertAuthErr.message}`);
            }
        }

        // 6. 백업해둔 푸시 구독(학생 새 학번 & 학부모 토큰) 복원
        if (subsToRestore.length > 0) {
            await supabaseAdmin.from('push_subscriptions').insert(subsToRestore);
        }

        return NextResponse.json({
            success: true,
            mode: 'executed',
            message: '새학기 진급 및 신입생 등록이 성공적으로 완료되었습니다.',
            summary
        });
    } catch (error: any) {
        console.error('Promote students API error:', error);
        return NextResponse.json(
            { error: '진급 처리 중 오류가 발생했습니다.', details: error.message },
            { status: 500 }
        );
    }
}

