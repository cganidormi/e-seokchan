const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugDuplication() {
    console.log('--- DATA START ---');
    const { data: students } = await supabase
        .from('students')
        .select('*')
        .eq('grade', 1);

    const { data: auth } = await supabase
        .from('students_auth')
        .select('*')
        .limit(10);

    console.log('STUDENTS:' + JSON.stringify(students));
    console.log('AUTH:' + JSON.stringify(auth));
    console.log('--- DATA END ---');
}

debugDuplication();
