import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
    try {
        const { students } = await request.json();

        if (!students || !Array.isArray(students)) {
            return NextResponse.json({ error: 'students 데이터 배열이 필요합니다.' }, { status: 400 });
        }

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

        if (!supabaseUrl || !serviceKey) {
            return NextResponse.json(
                { error: '서버 환경 변수(SUPABASE_SERVICE_ROLE_KEY)가 설정되지 않았습니다. .env.local 및 서버 상태를 확인하세요.' },
                { status: 500 }
            );
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceKey);

        // 이전 이름으로 등록된 동일 (학년, 반, 번호) 데이터가 있다면 먼저 삭제
        for (const s of students) {
            if (s.student_id) {
                await supabaseAdmin
                    .from('students')
                    .delete()
                    .eq('grade', s.grade)
                    .eq('class', s.class)
                    .eq('number', s.number)
                    .neq('student_id', s.student_id);
            }
        }

        // Primary Key인 student_id 기준으로 upsert 진행
        const { data, error } = await supabaseAdmin
            .from('students')
            .upsert(students, { onConflict: 'student_id' });

        if (error) {
            console.error('Upsert students error:', error);
            return NextResponse.json(
                { error: '학생 데이터베이스 저장 실패', details: error.message, code: error.code },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, data });
    } catch (e: any) {
        console.error('Unexpected error in upsert-students:', e);
        return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.', details: e.message }, { status: 500 });
    }
}
