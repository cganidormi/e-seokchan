import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminRequest } from '@/lib/adminAuth';

export async function POST(request: Request) {
    try {
        // 1. 관리자/교사 신분증(인증) 엄격 검증
        const authResult = await verifyAdminRequest(request);
        if (!authResult.authorized) {
            return authResult.errorResponse!;
        }

        const { student_id } = await request.json();
        if (!student_id) {
            return NextResponse.json({ error: 'student_id 필요' }, { status: 400 });
        }

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

        if (!supabaseUrl || !serviceKey) {
            return NextResponse.json(
                { error: '서버 환경 변수(SUPABASE_SERVICE_ROLE_KEY)가 설정되지 않았습니다.' },
                { status: 500 }
            );
        }

        const supabase = createClient(supabaseUrl, serviceKey);

        const { error } = await supabase.from('students_auth').delete().eq('student_id', student_id);
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
