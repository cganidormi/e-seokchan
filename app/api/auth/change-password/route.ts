import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
    try {
        const { id, role, newPassword } = await request.json();

        if (!id || !role || !newPassword) {
            return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
        }

        // Determine the table and id column based on role
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

        // Hash the new password using bcrypt
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Initialize Supabase Admin client to bypass RLS restrictions
        // We must use the service_role key to write to _auth tables since standard client is locked out
        const supabaseAdmin = require('@supabase/supabase-js').createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );

        // Update the record with the new hashed password, clear temp_password
        const { data, error } = await supabaseAdmin
            .from(tableName)
            .update({
                password: hashedPassword,
                temp_password: null, // Clear the temporary password once changed
                must_change_password: false,
            })
            .eq(idColumn, id);

        if (error) {
            console.error('Database update error:', error);
            return NextResponse.json({ success: false, error: 'Failed to update database' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Change Password API Error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
