
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

const supabase = createClient(supabaseUrl, supabaseKey);

async function testOtherTeachers() {
    console.log('--- Fetching all teachers ---');
    const { data: teachers, error } = await supabase.from('teachers').select('*');
    if (error) {
        console.error('Error fetching teachers:', error.message);
        return;
    }

    console.log(`Found ${teachers?.length || 0} teachers in 'teachers' table.`);

    // Pick another teacher to test (not 이상찬)
    const otherTeacher = teachers?.find(t => t.name !== '이상찬');

    if (otherTeacher) {
        console.log(`\n--- Testing RPC for another teacher: ${otherTeacher.name} ---`);
        const { data: rpcData, error: rpcErr } = await supabase.rpc('validate_teacher_login', {
            p_teacher_id: otherTeacher.name,
            p_password: "1234" // Default temp password they might be using
        });

        console.log('RPC Result:', rpcData);
        if (rpcErr) console.error('RPC Error:', rpcErr.message);

        console.log('\n--- Checking if their info can be fetched using name ---');
        const { data: profile, error: profileErr } = await supabase
            .from('teachers')
            .select('*')
            .eq('name', otherTeacher.name)
            .single();

        console.log('Profile Fetch Result:', profile ? profile.id : 'NOT FOUND');
        if (profileErr) console.error('Profile Error:', profileErr.message);
    } else {
        console.log('No other teachers found to test.');
    }
}

testOtherTeachers();
