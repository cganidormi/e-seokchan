
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
let env = '';
try { env = fs.readFileSync('.env.local', 'utf8'); } catch(e) {}
const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const key = (env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();
const supabase = createClient(url, key);

async function cleanup() {
    // 1. Target endpoint for Choi Ji-hoo's parent
    const targetEndpoint = "https://fcm.googleapis.com/fcm/send/fR1:APA91bGU9-rB10DM7FkKYbwOp0iRGXU9Y0_r7fE-v81fV6X-E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K9T_U9E-K" 
    // Wait, the endpoint was truncated in the output. I need to get it via matching the token GQ4232 first.
    
    console.log('--- Phase 1: Identifying target endpoints ---');
    const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('parent_token', 'GQ4232');
    
    if (!subs || subs.length === 0) {
        console.log('Could not find endpoint for Choi Ji-hoo (GQ4232). Aborting.');
        return;
    }

    const endpoints = subs.map(s => {
        try { return (typeof s.subscription_json === 'string' ? JSON.parse(s.subscription_json) : s.subscription_json).endpoint; } catch(e) { return null; }
    }).filter(Boolean);

    console.log(`Found ${endpoints.length} endpoint(s) currently linked to Choi Ji-hoo.`);

    // 2. Identify and remove WRONG tokens from these endpoints
    // Allowed: GQ4232 (Ji-hoo), CG5259 (Won-seob)
    const allowedTokens = ['GQ4232', 'CG5259'];
    
    console.log('\n--- Phase 2: Cleaning up redundant subscriptions ---');
    const { data: allWithEndpoints } = await supabase.from('push_subscriptions').select('*');
    
    let deletedCount = 0;
    for (const sub of allWithEndpoints) {
        let ep = '';
        try { ep = (typeof sub.subscription_json === 'string' ? JSON.parse(sub.subscription_json) : sub.subscription_json).endpoint; } catch(e) {}
        
        if (endpoints.includes(ep)) {
            if (!allowedTokens.includes(sub.parent_token)) {
                console.log(`Deleting incorrect subscription ID ${sub.id} (Token: ${sub.parent_token}) for this device.`);
                const { error } = await supabase.from('push_subscriptions').delete().eq('id', sub.id);
                if (error) console.error('Error deleting:', error);
                else deletedCount++;
            } else {
                console.log(`Keeping legitimate subscription ID ${sub.id} (Token: ${sub.parent_token}) for this device.`);
            }
        }
    }

    console.log(`\nCleanup complete. Total records deleted: ${deletedCount}`);
}
cleanup();
