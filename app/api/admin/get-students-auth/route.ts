import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
    try {
        const { student_ids } = await request.json();

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

        if (!supabaseUrl || !serviceKey) {
            return NextResponse.json(
                { error: '서버 환경 변수(SUPABASE_SERVICE_ROLE_KEY)가 설정되지 않았습니다.' },
                { status: 500 }
            );
        }

        const supabase = createClient(supabaseUrl, serviceKey);

        let query = supabase.from('students_auth').select('student_id, temp_password');
        if (student_ids && Array.isArray(student_ids) && student_ids.length > 0) {
            query = query.in('student_id', student_ids);
        }

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching students_auth:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (e: any) {
        console.error('Unexpected error in get-students-auth:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
