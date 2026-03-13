
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
let env = '';
try { env = fs.readFileSync('.env.local', 'utf8'); } catch(e) {}
const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const key = (env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();
const supabase = createClient(url, key);

async function finalAudit() {
    const names = ['최지후', '최원섭', '김혜원', '황요한'];
    const { data: students, error: studentError } = await supabase.from('students').select('*');
    if (studentError) { console.error(studentError); return; }

    const targetStudents = students.filter(s => names.includes(s.name));
    const tokens = targetStudents.map(s => s.parent_token).filter(Boolean);
    
    console.log('--- Subscriptions for target students ---');
    const { data: subs, error: subError } = await supabase.from('push_subscriptions').select('*').in('parent_token', tokens);
    if (subError) { console.error(subError); return; }

    subs.forEach(s => {
        const student = targetStudents.find(f => f.parent_token === s.parent_token);
        console.log(`Student: ${student ? student.name : 'Unknown'}(${s.parent_token}), id: ${s.id}`);
    });

    if (subs.length === 0) console.log('No subscriptions found for these tokens.');
}
finalAudit();
