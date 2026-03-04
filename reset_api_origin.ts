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
                { error: '?숈깮 ID? ??鍮꾨?踰덊샇媛 ?꾩슂?⑸땲??' },
                { status: 400 }
            );
        }

        // ?쒕쾭 ?ъ씠?쒖뿉??SERVICE_ROLE ?ㅻ? ?ъ슜?섏뿬 RLS瑜?臾댁떆?섍퀬 鍮꾨?踰덊샇 珥덇린??(upsert)
        const { error } = await supabase.from('students_auth').upsert(
            {
                student_id,
                username: student_id,
                temp_password: new_password,
                must_change_password: true,
            },
            { onConflict: 'student_id' }
        );

        if (error) {
            console.error('Password reset error:', error);
            return NextResponse.json(
                { error: '?곗씠?곕쿋?댁뒪 ?낅뜲?댄듃 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.', details: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Unexpected error:', error);
        return NextResponse.json(
            { error: '?쒕쾭 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.' },
            { status: 500 }
        );
    }
}
