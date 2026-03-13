
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
let env = '';
try { env = fs.readFileSync('.env.local', 'utf8'); } catch(e) {}
const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const key = (env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();
const supabase = createClient(url, key);

async function check() {
    const names = ['최지후', '김혜원', '한요한', '한연서'];
    const { data: students } = await supabase.from('students').select('*');
    
    console.log('--- Matching Students ---');
    students.forEach(s => {
        if (names.some(n => s.name.includes(n))) {
            console.log(`${s.name} (${s.student_id}) -> Token: ${s.parent_token}`);
        }
    });
}
check();
