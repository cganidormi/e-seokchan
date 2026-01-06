const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
    try {
        console.log("--- START CHECK ---");
        const { data: sa, error: sae } = await supabase.from('students_auth').select('student_id').limit(1);
        console.log("AUTH_ACCESS:", sae ? "FAIL " + sae.message : "OK");

        const { data: st, error: ste } = await supabase.from('students').select('student_id').limit(1);
        console.log("PROFILE_ACCESS:", ste ? "FAIL " + ste.message : "OK");

        const { data: user } = await supabase.from('students_auth').select('*').eq('student_id', '1101권준우');
        console.log("USER_AUTH:", user && user.length > 0 ? "FOUND" : "NOT_FOUND");

        const { data: profile } = await supabase.from('students').select('*').eq('student_id', '1101권준우');
        console.log("USER_PROFILE:", profile && profile.length > 0 ? "FOUND" : "NOT_FOUND");

        console.log("--- END CHECK ---");
    } catch (e) { console.error(e); }
}
check();
