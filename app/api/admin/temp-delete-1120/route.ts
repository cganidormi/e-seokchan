import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase Service Role Key (Bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
    try {
        console.log("Attempting to delete student 1120...");

        // Find 1-1-20
        const { data, error } = await supabase.from('students').select('*').match({ grade: 1, class: 1, number: 20 });

        if (error) {
            return NextResponse.json({ success: false, error: error.message });
        }

        if (data && data.length > 0) {
            const student = data[0];
            const messages = [];

            if (student.student_id) {
                await supabase.from('students_auth').delete().match({ student_id: student.student_id });
                await supabase.from('monthly_return_applications').delete().match({ student_id: student.student_id });
                messages.push(`Deleted auth and monthly return for ${student.student_id}`);
            }

            const legacy_id = `10120`;
            await supabase.from('students_auth').delete().match({ student_id: legacy_id });
            messages.push(`Deleted legacy auth ${legacy_id}`);

            const { error: delErr } = await supabase.from('students').delete().match({ grade: 1, class: 1, number: 20 });

            if (delErr) {
                return NextResponse.json({ success: false, error: delErr.message });
            }

            return NextResponse.json({ success: true, message: `Successfully deleted student 1120. Details: ${messages.join(', ')}` });
        } else {
            return NextResponse.json({ success: true, message: 'Student 1120 not found.' });
        }
    } catch (error: any) {
        return NextResponse.json(
            { error: '서버 오류가 발생했습니다.', details: error.message },
            { status: 500 }
        );
    }
}
