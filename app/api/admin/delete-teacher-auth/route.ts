import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminRequest } from '@/lib/adminAuth';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
    try {
        // 1. 관리자/교사 신분증(인증) 엄격 검증
        const authResult = await verifyAdminRequest(request);
        if (!authResult.authorized) {
            return authResult.errorResponse!;
        }

        const { teacher_id } = await request.json();
        if (!teacher_id) {
            return NextResponse.json({ error: 'teacher_id 필요' }, { status: 400 });
        }
        const { error } = await supabase.from('teachers_auth').delete().eq('teacher_id', teacher_id);
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
