
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

let supabaseUrl = '';
let supabaseKey = '';

try {
    const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
    const lines = envFile.split('\n');
    for (const line of lines) {
        if (line.trim().startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
            supabaseUrl = line.split('=')[1].replace(/"/g, '').trim();
        }
        if (line.trim().startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
            supabaseKey = line.split('=')[1].replace(/"/g, '').trim();
        }
    }
} catch (e) {}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAll() {
    const { data: students, error } = await supabase.from('students').select('student_id, name, parent_token');
    if (error) { console.error(error); return; }
    
    const tokenMap = new Map();
    students.forEach(s => {
        if (s.parent_token) {
            if (!tokenMap.has(s.parent_token)) tokenMap.set(s.parent_token, []);
            tokenMap.get(s.parent_token).push(`${s.name} (${s.student_id})`);
        }
    });
    
    console.log('--- Duplicate Tokens Found ---');
    let duplicateCount = 0;
    tokenMap.forEach((names, token) => {
        if (names.length > 1) {
            console.log(`Token ${token}: ${names.join(', ')}`);
            duplicateCount++;
        }
    });
    console.log(`\nTotal duplicate tokens: ${duplicateCount}`);

    console.log('\n--- Push Subscriptions with multiple tokens per device ---');
    const { data: subs, error: subError } = await supabase.from('push_subscriptions').select('*');
    if (subError) { console.error(subError); return; }

    const deviceMap = new Map();
    subs.forEach(sub => {
        let endpoint = '';
        try {
            const subObj = typeof sub.subscription_json === 'string' ? JSON.parse(sub.subscription_json) : sub.subscription_json;
            endpoint = subObj.endpoint;
        } catch(e) { endpoint = 'invalid'; }

        if (!deviceMap.has(endpoint)) deviceMap.set(endpoint, new Set());
        deviceMap.get(endpoint).add(sub.parent_token);
    });

    let multiTokenDevices = 0;
    deviceMap.forEach((tokens, endpoint) => {
        if (tokens.size > 1) {
            multiTokenDevices++;
            console.log(`Device ${endpoint.substring(endpoint.length - 20)} has ${tokens.size} tokens: ${Array.from(tokens).join(', ')}`);
        }
    });
    console.log(`\nTotal devices with multiple tokens: ${multiTokenDevices}`);
}
checkAll();
