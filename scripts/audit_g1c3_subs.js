
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
let env = '';
try { env = fs.readFileSync('.env.local', 'utf8'); } catch(e) {}
const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const key = (env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();
const supabase = createClient(url, key);

async function auditG1C3() {
    console.log('--- Step 1: Fetching G1 C3 Students ---');
    const { data: students, error: studentError } = await supabase.from('students').select('name, student_id, parent_token').eq('grade', 1).eq('class', 3);
    if (studentError) { console.error(studentError); return; }

    const tokens = students.map(s => s.parent_token).filter(Boolean);
    console.log(`Found ${students.length} students and ${tokens.length} tokens.`);

    console.log('\n--- Step 2: Fetching Subscriptions ---');
    const { data: subs, error: subError } = await supabase.from('push_subscriptions').select('*').in('parent_token', tokens);
    if (subError) { console.error(subError); return; }

    const epMap = {}; // endpoint -> [tokens/students]
    
    subs.forEach(s => {
        const student = students.find(f => f.parent_token === s.parent_token);
        let ep = '';
        try { ep = (typeof s.subscription_json === 'string' ? JSON.parse(s.subscription_json) : s.subscription_json).endpoint; } catch(e) {}
        
        if (!epMap[ep]) epMap[ep] = [];
        epMap[ep].push(`${student ? student.name : 'Unknown'} (${s.parent_token})`);
    });

    console.log('\n--- Step 3: Detection Overlapping Devices ---');
    let overlapFound = false;
    for (const [ep, studentList] of Object.entries(epMap)) {
        if (studentList.length > 1) {
            console.log(`OVERLAP DETECTED on device ...${ep.substring(ep.length - 20)}`);
            console.log(`  - Registered students: ${studentList.join(', ')}`);
            overlapFound = true;
        } else {
            console.log(`Unique device ...${ep.substring(ep.length - 20)} for ${studentList[0]}`);
        }
    }
    
    if (!overlapFound) {
        console.log('No overlapping devices found for G1 C3 students.');
    }
}
auditG1C3();
