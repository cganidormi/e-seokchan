
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
let env = '';
try { env = fs.readFileSync('.env.local', 'utf8'); } catch(e) {}
const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const key = (env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();
const supabase = createClient(url, key);

async function checkSiblings() {
    const tokens = ['GQ4232', 'CG5259'];
    const { data: subs, error } = await supabase.from('push_subscriptions').select('*').in('parent_token', tokens);
    if (error) { console.error(error); return; }

    console.log(`Checking ${tokens.length} tokens for shared endpoints...`);
    
    if (subs.length === 0) {
        console.log('No subscriptions found for either token.');
        return;
    }

    const tokenMap = {}; // token -> [endpoints]
    const endpointMap = {}; // endpoint -> [tokens]

    subs.forEach(s => {
        let ep = '';
        try {
            const obj = (typeof s.subscription_json === 'string' ? JSON.parse(s.subscription_json) : s.subscription_json);
            ep = obj.endpoint;
        } catch(e) {}
        if (!ep) return;

        if (!tokenMap[s.parent_token]) tokenMap[s.parent_token] = [];
        tokenMap[s.parent_token].push(ep);

        if (!endpointMap[ep]) endpointMap[ep] = [];
        endpointMap[ep].push(s.parent_token);
    });

    tokens.forEach(t => {
        const count = (tokenMap[t] || []).length;
        console.log(`Token: ${t} has ${count} registration(s).`);
    });

    let shared = false;
    for (const [ep, tList] of Object.entries(endpointMap)) {
        if (tList.includes('GQ4232') && tList.includes('CG5259')) {
            console.log('Match found! Endpoint is shared by both tokens.');
            shared = true;
        }
    }
    
    if (!shared) {
        console.log('Result: These two tokens are NOT registered on the same device in the current database.');
    }
}
checkSiblings();
