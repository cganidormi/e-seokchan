
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
let env = '';
try { env = fs.readFileSync('.env.local', 'utf8'); } catch(e) {}
const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const key = (env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();
const supabase = createClient(url, key);

async function checkChoiFamily() {
    const { data: family, error: familyError } = await supabase.from('students').select('name, student_id, parent_token').ilike('name', '최%');
    if (familyError) { console.error(familyError); return; }

    console.log('--- Choi Family Members & Tokens ---');
    family.forEach(s => {
        console.log(`${s.name} (${s.student_id}) | Token: ${s.parent_token}`);
    });
    
    const tokens = family.map(s => s.parent_token).filter(Boolean);
    const { data: subs, error: subError } = await supabase.from('push_subscriptions').select('*').in('parent_token', tokens);
    if (subError) { console.error(subError); return; }

    console.log('\n--- Active Push Subscriptions for these Tokens ---');
    subs.forEach(s => {
        const student = family.find(f => f.parent_token === s.parent_token);
        console.log(`Token: ${s.parent_token} (${student ? student.name : 'Unknown'}) | Registered at: ${s.created_at}`);
    });

    if (subs.length === 0) {
        console.log('No active push subscriptions found for any Choi family member tokens.');
    }
}
checkChoiFamily();
