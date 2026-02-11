import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { updates } = body;

        // Use service role to bypass RLS
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

        // Ensure createClient is imported/used correctly for server-side
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            supabaseKey,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        if (!updates || !Array.isArray(updates)) {
            return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
        }

        // Parallel execution for speed
        const promises = updates.map(update =>
            supabase
                .from('students')
                .update({ room_number: update.room_number })
                .eq('student_id', update.student_id)
        );

        const results = await Promise.all(promises);

        // Check for errors
        const errors = results.filter(r => r.error).map(r => r.error);

        if (errors.length > 0) {
            console.error('Partial update failures:', errors);
            return NextResponse.json({ error: 'Partial update failure', details: errors }, { status: 500 });
        }

        return NextResponse.json({ message: 'Saved successfully' });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
    }
}
