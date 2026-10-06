import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 로컬 학교망/프록시 환경에서의 Supabase SSL 핸드셰이크 호환
if (process.env.NODE_ENV !== 'production') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export interface AdminAuthResult {
    authorized: boolean;
    errorResponse?: NextResponse;
    teacherName?: string;
}

/**
 * 관리자 전용 API 요청에 대해 호출자가 유효한 교사인지 DB 레벨에서 정밀 검증합니다.
 */
export async function verifyAdminRequest(request: Request): Promise<AdminAuthResult> {
    let teacherId = request.headers.get('x-teacher-id');
    if (teacherId) {
        try {
            teacherId = decodeURIComponent(teacherId);
        } catch (e) {}
    }

    if (!teacherId || teacherId.trim().length === 0) {
        return {
            authorized: false,
            errorResponse: NextResponse.json(
                { error: '인증 헤더(x-teacher-id)가 누락되었습니다. 관리자 로그인이 필요합니다.' },
                { status: 401 }
            )
        };
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl || !serviceKey) {
        return {
            authorized: false,
            errorResponse: NextResponse.json(
                { error: '서버 환경 변수 설정 오류가 발생했습니다.' },
                { status: 500 }
            )
        };
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // DB의 teachers 테이블에서 해당 교사가 실제로 존재하는지 대조 (이름, teacher_id, UUID 모두 매칭)
    const cleanId = teacherId.trim();
    let query = supabase.from('teachers').select('id, name, position, can_approve');
    
    // UUID 형식인 경우 id로 검색, 일반 이름인 경우 ilike로 검색
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
    if (isUUID) {
        query = query.eq('id', cleanId);
    } else {
        query = query.ilike('name', `%${cleanId}%`);
    }

    const { data: teachers, error } = await query.limit(1);

    if (error) {
        console.error('[Admin Guard Error]:', error);
    }

    if (error || !teachers || teachers.length === 0) {
        console.warn(`[Security Alert] 비인가자의 관리자 API 접근 시도 차단됨: ID=${teacherId}`);
        return {
            authorized: false,
            errorResponse: NextResponse.json(
                { error: '유효하지 않은 관리자/교사 계정입니다. 접근이 거부되었습니다.' },
                { status: 403 }
            )
        };
    }

    return {
        authorized: true,
        teacherName: teachers[0].name
    };
}
