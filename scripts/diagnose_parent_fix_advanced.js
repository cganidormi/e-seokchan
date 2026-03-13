
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
} catch (e) {
    console.error('Could not read .env.local', e);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('--- Phase 1: Student Data ---');
    const { data: students, error } = await supabase
        .from('students')
        .select('*')
        .or('name.eq.최지후,name.eq.김혜원,name.eq.한요한');

    if (error) { console.error(error); return; }
    
    students.forEach(s => {
        console.log(`Student: ${s.name} (${s.student_id}), G${s.grade} C${s.class}, Token: ${s.parent_token}`);
    });

    console.log('\n--- Phase 2: Push Subscriptions ---');
    const tokens = students.map(s => s.parent_token).filter(Boolean);
    const { data: subs, error: subError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .in('parent_token', tokens);

    if (subError) { console.error(subError); return; }

    subs.forEach(sub => {
        const subObj = typeof sub.subscription_json === 'string' ? JSON.parse(sub.subscription_json) : sub.subscription_json;
        const endpoint = subObj.endpoint;
        const student = students.find(s => s.parent_token === sub.parent_token);
        console.log(`Subscription: Token=${sub.parent_token} (${student ? student.name : '?'}), Device=${sub.device_type}, Endpoint=${endpoint}`);
    });

    // Check for duplicate endpoints
    const endpoints = subs.map(sub => {
        const subObj = typeof sub.subscription_json === 'string' ? JSON.parse(sub.subscription_json) : sub.subscription_json;
        return subObj.endpoint;
    });
    
    const uniqueEndpoints = new Set(endpoints);
    if (uniqueEndpoints.size < endpoints.length) {
        console.log('\n[WARNING] Shared endpoints detected! Multiple tokens are registered for the same device.');
        
        const endpointToTokens = new Map();
        subs.forEach(sub => {
            const subObj = typeof sub.subscription_json === 'string' ? JSON.parse(sub.subscription_json) : sub.subscription_json;
            const endpoint = subObj.endpoint;
            if (!endpointToTokens.has(endpoint)) endpointToTokens.set(endpoint, []);
            endpointToTokens.get(endpoint).push(sub.parent_token);
        });

        endpointToTokens.forEach((tokens, ep) => {
            if (tokens.length > 1) {
                console.log(`Endpoint ${ep.substring(ep.length - 20)} is shared by: ${tokens.join(', ')}`);
            }
        });
    }

    console.log('\n--- Phase 3: Token Conflicts in Students Table ---');
    const allTokens = students.map(s => s.parent_token).filter(Boolean);
    for (const t of allTokens) {
        const { data: conflicts } = await supabase.from('students').select('name, student_id').eq('parent_token', t);
        if (conflicts && conflicts.length > 1) {
            console.log(`Token ${t} is assigned to multiple students: ${conflicts.map(c => c.name).join(', ')}`);
        }
    }
}

check();
