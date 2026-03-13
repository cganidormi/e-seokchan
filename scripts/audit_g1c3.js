
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
let env = '';
try { env = fs.readFileSync('.env.local', 'utf8'); } catch(e) {}
const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const key = (env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();
const supabase = createClient(url, key);

async function check() {
    const { data, error } = await supabase.from('students').select('name, student_id, grade, class, parent_token').eq('grade', 1).eq('class', 3);
    if (error) { console.error(error); return; }
    
    console.log('--- G1 C3 Students Audit ---');
    data.sort((a,b) => a.student_id.localeCompare(b.student_id)).forEach(s => {
        console.log(`- ${s.name} (${s.student_id}) Token: ${s.parent_token}`);
    });
}
check();
