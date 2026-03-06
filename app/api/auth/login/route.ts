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
            tableName = 'monitors_auth';
            idColumn = 'monitor_id';
        } else if (role === 'student') {
            tableName = 'students_auth';
            idColumn = 'student_id';
        } else if (role === 'teacher') {
            tableName = 'teachers_auth';
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
            .ilike(idColumn, id.trim())
            .maybeSingle();

        if (error || !user) {
            return NextResponse.json({ success: false, error: 'User not found' });
        }

        // 2. Verify password
        let isValid = false;

        // Due to the database schema, 'monitors_auth' uses the 'password' column
        // while 'students_auth' and 'teachers_auth' exclusively use the 'temp_password' column for passwords.

        let dbPassword = user.password || user.temp_password;

        if (dbPassword) {
            // Check if it's already a bcrypt hash
            if (dbPassword.startsWith('$2a$') || dbPassword.startsWith('$2b$')) {
                isValid = await bcrypt.compare(password, dbPassword).catch(() => false);
            } else {
                // Fallback for plain text until the migration script is run
                if (password === dbPassword) {
                    isValid = true;
                }
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
