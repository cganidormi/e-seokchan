import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase Service Role Key (Bypasses RLS)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
    try {
        const { student_id, new_notice_text } = await request.json();

        if (!student_id || typeof new_notice_text !== 'string') {
            return NextResponse.json(
                { error: '학생 인증 정보와 텍스트 내용이 필요합니다.' },
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

        // 권한 확인 완료, system_settings 테이블 학생 전광판 데이터(student_notice) 업데이트 (upsert)
        const { error } = await supabase.from('system_settings').upsert(
            {
                setting_key: 'student_notice',
                setting_value: new_notice_text,
            },
            { onConflict: 'setting_key' }
        );

        if (error) {
            console.error('Student Notice update error:', error);
            return NextResponse.json(
                { error: '데이터베이스 업데이트 중 오류가 발생했습니다.', details: error.message },
                { status: 500 }
            );
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
