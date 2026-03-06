import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase Service Role Key (Bypasses RLS)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
    try {
        const { student_id, new_password } = await request.json();

        if (!student_id || !new_password) {
            return NextResponse.json(
                { error: '학생 ID와 새 비밀번호가 필요합니다.' },
                { status: 400 }
            );
        }

        // 서버 사이드에서 SERVICE_ROLE 키를 사용하여 RLS를 무시하고 비밀번호 초기화 (upsert)
        const { error } = await supabase.from('students_auth').upsert(
            {
                student_id,
                temp_password: new_password,
                must_change_password: true,
            },
            { onConflict: 'student_id' }
        );

        if (error) {
            console.error('Password reset error:', error);
            return NextResponse.json(
                { error: '데이터베이스 업데이트 중 오류가 발생했습니다.', details: error.message },
                { status: 500 }
            );
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
