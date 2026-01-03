const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugDuplication() {
    console.log('--- CHECKING STUDENTS FOR 1-1-1 ---');
    const { data: students, error: sErr } = await supabase
        .from('students')
        .select('*')
        .eq('grade', 1)
        .eq('class', 1)
        .eq('number', 1);
    console.log('Student data:', students);

    console.log('--- CHECKING STUDENTS_AUTH FOR 1-1-1 RELATED IDS ---');
    // Check for both 1101... and 10101...
    const { data: auth, error: aErr } = await supabase
        .from('students_auth')
        .select('*')
        .or('student_id.ilike.1101%,student_id.ilike.10101%');
    console.log('Auth data matches:', auth);

    console.log('--- CHECKING TRIGGERS (if possible via RPC) ---');
    // Usually triggers aren't directly visible via standard select, but we can try to find them if there's a custom function or common knowledge.
    // Since I can't easily see Postgres triggers without raw SQL access (which I don't have via supabase client), 
    // I'll rely on identifying the pattern of 10101.
}

debugDuplication();
