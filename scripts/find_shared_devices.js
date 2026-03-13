
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
let env = '';
try { env = fs.readFileSync('.env.local', 'utf8'); } catch(e) {}
const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const key = (env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();
const supabase = createClient(url, key);

async function deepAudit() {
    const { data: subs, error } = await supabase.from('push_subscriptions').select('*');
    if (error) { console.error('Error fetching subs:', error); return; }

    const epMap = {}; 
    subs.forEach(s => {
        let ep = '';
        try {
            const obj = (typeof s.subscription_json === 'string' ? JSON.parse(s.subscription_json) : s.subscription_json);
            ep = obj.endpoint;
        } catch(e) {}
        if (!ep) return;
        
        if (!epMap[ep]) epMap[ep] = [];
        epMap[ep].push({token: s.parent_token, sid: s.student_id, tid: s.teacher_id, created: s.created_at});
    });

    console.log('--- SHARED DEVICE AUDIT ---');
    let sharedCount = 0;
    for (const [ep, list] of Object.entries(epMap)) {
        if (list.length > 1) {
            sharedCount++;
            console.log(`\n[Shared Device ${sharedCount}] Endpoint: ...${ep.substring(ep.length - 30)}`);
            list.forEach(item => {
                const label = item.tid ? `Teacher: ${item.tid}` : (item.token ? `Parent Token: ${item.token}` : `Student: ${item.sid}`);
                console.log(`  - ${label} (Created: ${item.created})`);
            });
        }
    }
    
    if (sharedCount === 0) {
        console.log('No devices with multiple registrations found in the database.');
    } else {
        console.log(`\nTotal shared devices found: ${sharedCount}`);
    }
}
deepAudit();
