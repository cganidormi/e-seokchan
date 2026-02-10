const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkYHJ() {
    // 1. Find teacher named '양현재'
    const { data: teachers } = await supabase.from('teachers').select('*').eq('name', '양현재');
    console.log('Teachers with name 양현재:', JSON.stringify(teachers));

    if (teachers && teachers.length > 0) {
        const tid = teachers[0].teacher_id;
        console.log(`Checking teachers_auth for teacher_id: ${tid}`);
        const { data: auth } = await supabase.from('teachers_auth').select('*').eq('teacher_id', tid).maybeSingle();
        console.log('Auth record:', JSON.stringify(auth));
    }

    // 2. Also check if ID itself is '양현재' in monitors_auth again just in case
    const { data: mon } = await supabase.from('monitors_auth').select('*').eq('monitor_id', '양현재').maybeSingle();
    console.log('Monitor record with ID 양현재:', JSON.stringify(mon));
}

checkYHJ();
