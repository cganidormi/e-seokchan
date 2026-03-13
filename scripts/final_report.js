
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
let env = '';
try { env = fs.readFileSync('.env.local', 'utf8'); } catch(e) {}
const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const key = (env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();
const supabase = createClient(url, key);

async function finalReport() {
    console.log('--- Step 1: Choi Ji-hoo Token ---');
    const { data: choi } = await supabase.from('students').select('parent_token').eq('name', '최지후').single();
    if (!choi) { console.log('Choi not found'); return; }
    const tokenGQ = choi.parent_token;
    console.log(`Choi Ji-hoo's token: ${tokenGQ}`);

    console.log('\n--- Step 2: Push Subscriptions for Choi Ji-hoo ---');
    const { data: choiSubs } = await supabase.from('push_subscriptions').select('*').eq('parent_token', tokenGQ);
    if (!choiSubs || choiSubs.length === 0) { console.log('No push subs for Choi'); return; }
    
    const endpoints = choiSubs.map(s => {
        try { 
            const subObj = (typeof s.subscription_json === 'string' ? JSON.parse(s.subscription_json) : s.subscription_json);
            return subObj.endpoint;
        } catch(e) { return null; }
    }).filter(Boolean);
    console.log(`Found ${endpoints.length} endpoints for Choi.`);

    console.log('\n--- Step 3: All Tokens Linked to These Endpoints ---');
    const { data: allSubs } = await supabase.from('push_subscriptions').select('*');
    const linkedTokens = new Set();
    allSubs.forEach(s => {
        let ep = '';
        try { 
            const subObj = (typeof s.subscription_json === 'string' ? JSON.parse(s.subscription_json) : s.subscription_json);
            ep = subObj.endpoint;
        } catch(e) {}
        if (endpoints.includes(ep)) {
            linkedTokens.add(s.parent_token);
        }
    });
    console.log('Linked Tokens:', Array.from(linkedTokens));

    console.log('\n--- Step 4: Students for Linked Tokens ---');
    const { data: students } = await supabase.from('students').select('name, student_id, parent_token').in('parent_token', Array.from(linkedTokens));
    students.forEach(s => {
        console.log(`- ${s.name} (${s.student_id}) [Token: ${s.parent_token}]`);
    });

    console.log('\n--- Step 5: Global Token Conflicts ---');
    const { data: allStudents } = await supabase.from('students').select('name, student_id, parent_token');
    const tokenMap = {};
    allStudents.forEach(s => {
        if (!s.parent_token) return;
        if (!tokenMap[s.parent_token]) tokenMap[s.parent_token] = [];
        tokenMap[s.parent_token].push(`${s.name} (${s.student_id})`);
    });
    
    let dupFound = false;
    for (const [token, names] of Object.entries(tokenMap)) {
        if (names.length > 1) {
            console.log(`DUPLICATE TOKEN: ${token} is shared by: ${names.join(', ')}`);
            dupFound = true;
        }
    }
    if (!dupFound) console.log('No duplicate tokens found in students table.');
}
finalReport();
