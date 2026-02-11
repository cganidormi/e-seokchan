import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { updates } = body;

        // Use service role if available, otherwise fallback to Anon key (assuming public update policy exists)
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

        if (!supabaseKey) {
            console.error('Missing Supabase Key');
            return NextResponse.json({ error: 'Server Configuration Error: Missing Supabase Key' }, { status: 500 });
        }

        // Ensure createClient is imported/used correctly for server-side
        const supabase = createClient(
            supabaseUrl,
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

        console.log(`Processing ${updates.length} room assignments...`);

        // Parallel execution for speed
        // Store explicit results to debug failures
        const results = await Promise.all(updates.map(async (update) => {
            const { error } = await supabase
                .from('students')
                .update({ room_number: update.room_number })
                .eq('student_id', update.student_id);

            return {
                student_id: update.student_id,
                error: error ? error.message : null,
                details: error
            };
        }));

        // Check for errors
        const failures = results.filter(r => r.error);

        if (failures.length > 0) {
            console.error('Partial update failures:', failures);
            // Return detailed error for the first failure to show in toast
            const firstError = failures[0];
            return NextResponse.json({
                error: `Update failed for ${firstError.student_id}: ${firstError.error}`,
                details: failures
            }, { status: 500 });
        }

        return NextResponse.json({ message: 'Saved successfully' });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
    }
}
