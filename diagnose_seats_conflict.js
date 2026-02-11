
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
    console.log('--- Diagnosing UPSERT (Double Run) ---');

    const { data: students, error: sErr } = await supabase.from('students').select('*').limit(1);
    if (sErr) { console.error(sErr); return; }
    const studentId = students[0].student_id;

    const payload = {
        room_number: 998, // Difference room to be safe
        seat_number: 1,
        student_id: studentId
    };

    // Run 1
    console.log('Upsert 1...');
    const { data: d1, error: e1 } = await supabase
        .from('seat_assignments')
        .upsert(payload, { onConflict: 'room_number, seat_number' })
        .select();

    if (e1) console.error('Error 1:', e1);
    else console.log('Success 1:', d1);

    // Run 2 (Should Update, not Error)
    console.log('Upsert 2...');
    const { data: d2, error: e2 } = await supabase
        .from('seat_assignments')
        .upsert(payload, { onConflict: 'room_number, seat_number' })
        .select();

    if (e2) {
        console.error('Error 2 (Likely Constraint Violation):', e2);
    } else {
        console.log('Success 2 (Upsert worked):', d2);
    }

    // Cleanup
    await supabase.from('seat_assignments').delete().eq('room_number', 998);
}

diagnose();
