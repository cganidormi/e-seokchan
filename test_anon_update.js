
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

let supabaseUrl = '';
let supabaseKey = ''; // Verify Anon Key works

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
    console.error('Missing Credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdate() {
    console.log('--- Testing Update with ANON KEY ---');

    // 1. Get a student
    const { data: students, error: sErr } = await supabase.from('students').select('*').limit(1);
    if (sErr) {
        console.error('Read Failed:', sErr);
        return;
    }
    const student = students[0];
    console.log('Target:', student.student_id, student.name);

    // 2. Try Update (No Change)
    const { data, error } = await supabase
        .from('students')
        .update({ room_number: student.room_number }) // Same value
        .eq('student_id', student.student_id)
        .select();

    if (error) {
        console.error('Update FAILED with Anon Key:', error);
    } else {
        console.log('Update SUCCEEDED with Anon Key!');
    }
}

testUpdate();
