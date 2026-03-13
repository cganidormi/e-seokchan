
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
let env = '';
try { env = fs.readFileSync('.env.local', 'utf8'); } catch(e) {}
const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const key = (env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();
const supabase = createClient(url, key);

async function findDups() {
    const { data, error } = await supabase.from('students').select('name, student_id, parent_token');
    if (error) { console.error(error); return; }
    
    const tokenToStudents = {};
    data.forEach(s => {
        if (!s.parent_token) return;
        if (!tokenToStudents[s.parent_token]) tokenToStudents[s.parent_token] = [];
        tokenToStudents[s.parent_token].push(`${s.name} (${s.student_id})`);
    });

    console.log('--- DUPLICATE TOKEN SCAN ---');
    let count = 0;
    for (const [token, students] of Object.entries(tokenToStudents)) {
        if (students.length > 1) {
            console.log(`Conflict: [${token}] shared by [${students.join(' / ')}]`);
            count++;
        }
    }
    if (count === 0) console.log('No duplicate tokens found.');
    console.log(`Total conflicts found: ${count}`);
}
findDups();
