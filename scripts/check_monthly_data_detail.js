
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
let env = '';
try { env = fs.readFileSync('.env.local', 'utf8'); } catch(e) {}
const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const key = (env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();
const supabase = createClient(url, key);

async function check() {
    const { data, error } = await supabase
        .from('monthly_return_applications')
        .select('*')
        .eq('target_year', 2026)
        .eq('target_month', 4);
    
    if (error) { console.error(error); return; }
    
    console.log('--- Monthly Return Applications Detail (April 2026) ---');
    data.forEach(r => {
        console.log(`Student ID: [${r.student_id}], is_weekly: [${r.is_weekly}]`);
    });
}
check();
