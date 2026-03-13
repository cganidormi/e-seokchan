
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
let env = '';
try { env = fs.readFileSync('.env.local', 'utf8'); } catch(e) {}
const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const key = (env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();
const supabase = createClient(url, key);

async function findOverlaps() {
    const { data: subs } = await supabase.from('push_subscriptions').select('*');
    const epMap = {}; // endpoint -> [tokens]
    
    subs.forEach(s => {
        let ep = '';
        try {
            const obj = (typeof s.subscription_json === 'string' ? JSON.parse(s.subscription_json) : s.subscription_json);
            ep = obj.endpoint;
        } catch(e) {}
        if (!ep) return;
        
        if (!epMap[ep]) epMap[ep] = new Set();
        epMap[ep].add(s.parent_token);
    });

    console.log('--- Devices with Multiple Parent Tokens ---');
    let found = false;
    for (const [ep, tokens] of Object.entries(epMap)) {
        if (tokens.size > 1) {
            found = true;
            const tokenList = Array.from(tokens);
            const { data: students } = await supabase.from('students').select('name, student_id, parent_token').in('parent_token', tokenList);
            console.log(`Device Endpoint: ...${ep.substring(ep.length - 30)}`);
            students.forEach(s => {
                console.log(`  - Student: ${s.name} (${s.student_id}) | Token: ${s.parent_token}`);
            });
            console.log('-------------------------------------------');
        }
    }
    if (!found) console.log('No overlapping devices found.');
}
findOverlaps();
