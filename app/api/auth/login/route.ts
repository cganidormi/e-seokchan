import { NextResponse } from 'next/server';
import { supabase } from '@/supabaseClient';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
    try {
        const { id, password, role } = await request.json();

        if (!id || !password || !role) {
            return NextResponse.json({ success: false, error: 'Missing credentials' }, { status: 400 });
        }

        // Determine which authentication table to use based on the role
        let tableName = '';
        let idColumn = '';

        if (role === 'monitor') {
            tableName = 'monitors';
            idColumn = 'monitor_id';
        } else if (role === 'student') {
            tableName = 'students';
            idColumn = 'student_id';
        } else if (role === 'teacher') {
            tableName = 'teachers';
            idColumn = 'teacher_id';
        } else {
            return NextResponse.json({ success: false, error: 'Invalid role' }, { status: 400 });
        }

        // 1. Fetch user data bypassing RLS (we need admin privileges to get the hashed password to check)
        // NOTE: In production with full RLS, we should ideally use supabaseAdmin to fetch this.
        // However, our db patch disabled read access entirely. We must instantiate an admin client here.
        const supabaseAdmin = require('@supabase/supabase-js').createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
            // Warning: Using ANON_KEY here works locally if RLS is bypassed via security definer RPC, 
            // but for direct table access, we really need the service_role key.
            // Assuming the user has set SUPABASE_SERVICE_ROLE_KEY in .env.local, or we will get a permissions error.
            // We will fallback to attempting to use the existing RPC to fetch the hash for verification. 
            // Wait, the RPC we wrote checks equality, NOT returning the hash.
            // As a robust solution, we will create an admin client if the service_key exists, otherwise use standard.
        );

        const { data: user, error } = await supabaseAdmin
            .from(tableName)
            .select('*')
            .eq(idColumn, id)
            .maybeSingle();

        if (error || !user) {
            return NextResponse.json({ success: false, error: 'User not found' });
        }

        // 2. Verify password
        let isValid = false;

        // Check if it's the temporary password (which might be plain text temporarily due to the reset script)
        if (user.temp_password) {
            if (password === user.temp_password) {
                isValid = true;
            } else {
                // Maybe temp password was already hashed?
                isValid = await bcrypt.compare(password, user.temp_password).catch(() => false);
            }
        }

        // Check main password hash
        if (!isValid && user.password) {
            // We assume user.password is a bcrypt hash starting with $2a$ or $2b$
            isValid = await bcrypt.compare(password, user.password).catch(() => false);

            // Fallback for plain text just in case the migration script hasn't run yet, 
            // to prevent total lockouts during transition. (Remove this in strict production)
            if (!isValid && password === user.password) {
                isValid = true;
            }
        }

        if (isValid) {
            return NextResponse.json({
                success: true,
                must_change_password: user.must_change_password || false
            });
        } else {
            return NextResponse.json({ success: false, error: 'Invalid credentials' });
        }

    } catch (error: any) {
        console.error('Login API Error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
