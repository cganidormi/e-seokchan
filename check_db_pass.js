const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
    try {
        console.log("--- START CHECK ---");

        // 1. Password check
        const { data: user } = await supabase.from('students_auth').select('temp_password').eq('student_id', '1101권준우').single();
        const password = user ? user.temp_password : "USER_NOT_FOUND";

        // 2. Count check
        const { count, error } = await supabase.from('students').select('*', { count: 'exact', head: true });
        const totalCount = error ? "ERROR " + error.message : count;

        const resultText = `PASSWORD: ${password}\nTOTAL_STUDENTS: ${totalCount}`;
        fs.writeFileSync('check_result.txt', resultText);
        console.log("Result saved to check_result.txt");

    } catch (e) {
        console.error(e);
        fs.writeFileSync('check_result.txt', `ERROR: ${e.message}`);
    }
}
check();
