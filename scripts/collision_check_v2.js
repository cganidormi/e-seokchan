
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
let env = '';
try { env = fs.readFileSync('.env.local', 'utf8'); } catch(e) {}
const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const key = (env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();
const supabase = createClient(url, key);

async function check() {
    const tokens = ['GQ4232', 'DA9449']; // Choi Ji-hoo, Kim Hye-won
    const { data: subs } = await supabase.from('push_subscriptions').select('*').in('parent_token', tokens);
    
    console.log(`Found ${subs.length} subscriptions for these tokens.`);
    
    subs.forEach(s => {
        let ep = '';
        try { ep = (typeof s.subscription_json === 'string' ? JSON.parse(s.subscription_json) : s.subscription_json).endpoint; } catch(e) {}
        console.log(`- ID: ${s.id}, Token: ${s.parent_token}, Endpoint: ${ep.substring(ep.length - 30)}`);
    });

    const endpoints = subs.map(s => {
        try { return (typeof s.subscription_json === 'string' ? JSON.parse(s.subscription_json) : s.subscription_json).endpoint; } catch(e) { return null; }
    });
    
    if (new Set(endpoints).size < endpoints.length) {
        console.log('\n>>> COLLISION FOUND! These tokens share the same device endpoint.');
    } else {
        console.log('\n>>> NO COLLISION. These tokens are on unique device endpoints.');
    }
}
check();
