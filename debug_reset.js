const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugReset() {
    console.log('--- CHECKING STUDENTS ---');
    const { data: students, error: sErr } = await supabase.from('students').select('*').limit(5);
    console.log('Students samples:', students);

    console.log('--- CHECKING STUDENTS_AUTH ---');
    const { data: auth, error: aErr } = await supabase.from('students_auth').select('*').limit(5);
    console.log('Auth samples:', auth);

    // Try deleting one from students_auth to test permissions
    if (auth && auth.length > 0) {
        console.log('--- TESTING SINGLE DELETE IN STUDENTS_AUTH ---');
        const { error: dErr } = await supabase.from('students_auth').delete().eq('student_id', auth[0].student_id);
        if (dErr) console.log('Delete test failed:', dErr.message);
        else console.log('Delete test success');
    }
}

debugReset();
