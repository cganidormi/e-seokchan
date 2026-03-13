
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
let env = '';
try { env = fs.readFileSync('.env.local', 'utf8'); } catch(e) {}
const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const key = (env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();
const supabase = createClient(url, key);

async function check() {
    console.log('Searching for students with "한":');
    const { data, error } = await supabase.from('students').select('*').ilike('name', '%한%');
    if (error) { console.error(error); return; }
    
    data.forEach(s => {
        console.log(`${s.name} (${s.student_id}) [Token: ${s.parent_token}]`);
    });
    
    if (data.length === 0) console.log('None found.');
}
check();
