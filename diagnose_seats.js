
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

let supabaseUrl = '';
let supabaseKey = '';

try {
    const envFile = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
    const lines = envFile.split('\n');
    for (const line of lines) {
        if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
            supabaseUrl = line.split('=')[1].replace(/"/g, '').trim();
        }
        if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
            supabaseKey = line.split('=')[1].replace(/"/g, '').trim();
        }
    }
} catch (e) {
    console.error('Could not read .env.local', e);
}

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log('--- Diagnosing seat_assignments (Detailed) ---');

    // 1. Get a student
    const { data: students, error: sErr } = await supabase.from('students').select('*').limit(1);
    if (sErr) {
        console.error('Failed to fetch students:', sErr);
        return;
    }
    const student = students[0];
    console.log('Test Student:', student.student_id, student.name);

    // 2. Attempt Upsert
    const payload = {
        room_number: 999,
        seat_number: 1,
        student_id: student.student_id
    };

    console.log('Payload:', payload);

    const { data, error } = await supabase
        .from('seat_assignments')
        .upsert(payload, { onConflict: 'room_number, seat_number' })
        .select();

    if (error) {
        console.error('!!! UPSERT ERROR !!!');
        console.dir(error, { depth: null });
    } else {
        console.log('Upsert Success:', data);

        // Clean up
        await supabase.from('seat_assignments').delete().eq('room_number', 999).eq('seat_number', 1);
    }

    // 3. Check for specific constraints that might NOT be 'room_number, seat_number'
    // If the unique constraint is named something else, upsert might fail if strict.
    // But usually it works.
}

diagnose();
