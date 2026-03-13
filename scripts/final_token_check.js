
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

let env = '';
try { env = fs.readFileSync('.env.local', 'utf8'); } catch(e) {}
const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const key = (env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();

if (!url || !key) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
    const { data, error } = await supabase.from('students').select('name, parent_token, student_id');
    if (error) {
        console.error('Error fetching students:', error);
        return;
    }

    const map = {};
    data.forEach(s => {
        if (!s.parent_token) return;
        if (!map[s.parent_token]) map[s.parent_token] = [];
        map[s.parent_token].push(`${s.name} (${s.student_id})`);
    });

    let found = false;
    for (const [token, names] of Object.entries(map)) {
        if (names.length > 1) {
            console.log(`DUPLICATE: ${token} -> ${names.join(', ')}`);
            found = true;
        }
    }
    
    if (!found) {
        console.log('NO_DUPLICATES_FOUND');
    }
}

check();
