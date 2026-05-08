
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
let env = '';
try { env = fs.readFileSync('.env.local', 'utf8'); } catch(e) {}
const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const key = (env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();
const supabase = createClient(url, key);

async function check() {
    const now = new Date();
    const today = new Date();
    today.setHours(0,0,0,0);
    
    console.log(`Current Time (Server): ${now.toISOString()}`);
    console.log(`Current Time (Local Approx): ${now.toLocaleString()}`);

    const { data, error } = await supabase
        .from('leave_requests')
        .select('*, leave_request_students(student_id)')
        .or(`student_id.eq.1315이창민`) // Simplify for main applicant
        .in('status', ['승인', '신청'])
        .gte('end_time', today.toISOString());
    
    if (error) { console.error(error); return; }
    
    console.log('--- Active/Future Leave Requests for 1315이창민 ---');
    data.forEach(r => {
        console.log(`ID: ${r.id}, Type: ${r.leave_type}, Status: ${r.status}`);
        console.log(`Start: ${r.start_time}`);
        console.log(`End:   ${r.end_time}`);
        const start = new Date(r.start_time);
        const end = new Date(r.end_time);
        const isActive = (now >= start && now <= end);
        console.log(`Currently Active?: ${isActive}`);
        console.log('---');
    });
}
check();
