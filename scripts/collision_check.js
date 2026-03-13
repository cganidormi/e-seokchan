
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
let env = '';
try { env = fs.readFileSync('.env.local', 'utf8'); } catch(e) {}
const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const key = (env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();
const supabase = createClient(url, key);

async function check() {
    console.log('--- Phase 1: Finding Students ---');
    const { data: students } = await supabase.from('students').select('*').or('name.eq.최지후,name.eq.김혜원,name.eq.한요한');
    console.log('Students found:', students.map(s => `${s.name} (${s.student_id}) [Token: ${s.parent_token}]`).join(', '));

    const choi = students.find(s => s.name === '최지후');
    if (!choi) { console.log('Choi Ji-hoo not found'); return; }

    console.log('\n--- Phase 2: Analyzing Choi Ji-hoo subscriptions ---');
    const { data: choiSubs } = await supabase.from('push_subscriptions').select('*').eq('parent_token', choi.parent_token);
    
    const choiEndpoints = choiSubs.map(s => {
        try { return (typeof s.subscription_json === 'string' ? JSON.parse(s.subscription_json) : s.subscription_json).endpoint; } catch(e) { return null; }
    }).filter(Boolean);

    console.log(`Choi Ji-hoo has ${choiEndpoints.length} registered endpoints.`);

    console.log('\n--- Phase 3: Checking for shared endpoints ---');
    const { data: allSubs } = await supabase.from('push_subscriptions').select('*');
    
    allSubs.forEach(s => {
        if (s.parent_token === choi.parent_token) return; // Skip own subs

        let ep = '';
        try { ep = (typeof s.subscription_json === 'string' ? JSON.parse(s.subscription_json) : s.subscription_json).endpoint; } catch(e) {}
        
        if (choiEndpoints.includes(ep)) {
            // Find student name for this token
            // We need to fetch it if not in our initial list
            console.log(`DEVICE COLLISION: Token ${s.parent_token} is registered on the same device as Choi Ji-hoo!`);
            console.log(`Wait, let me fetch who has token ${s.parent_token}...`);
        }
    });

    // 4. Identity of other tokens sharing devices
    const otherTokens = Array.from(new Set(allSubs.filter(s => {
        let ep = '';
        try { ep = (typeof s.subscription_json === 'string' ? JSON.parse(s.subscription_json) : s.subscription_json).endpoint; } catch(e) {}
        return choiEndpoints.includes(ep) && s.parent_token !== choi.parent_token;
    }).map(s => s.parent_token)));

    if (otherTokens.length > 0) {
        const { data: others } = await supabase.from('students').select('name, student_id, parent_token').in('parent_token', otherTokens);
        console.log('\n--- COLLISION REPORT ---');
        console.log(`Choi Ji-hoo's parent's device is ALSO receiving notifications for:`);
        others.forEach(o => {
            console.log(`- ${o.name} (${o.student_id}) [Token: ${o.parent_token}]`);
        });
    } else {
        console.log('\nNo direct endpoint collisions found for Choi Ji-hoo.');
    }
}
check();
