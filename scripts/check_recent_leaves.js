
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
let env = '';
try { env = fs.readFileSync('.env.local', 'utf8'); } catch(e) {}
const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const key = (env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();
const supabase = createClient(url, key);

async function check() {
    console.log('--- Recent Computer Leave (컴이석) Requests ---');
    const { data: requests, error } = await supabase
        .from('leave_requests')
        .select('id, student_id, leave_type, status, created_at')
        .eq('leave_type', '컴이석')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) { console.error(error); return; }

    // Fetch students to get names
    const studentIds = Array.from(new Set(requests.map(r => r.student_id)));
    const { data: students } = await supabase.from('students').select('student_id, name').in('student_id', studentIds);
    const studentMap = {};
    students?.forEach(s => studentMap[s.student_id] = s.name);

    requests.forEach(r => {
        const studentName = studentMap[r.student_id] || r.student_id;
        console.log(`Req ID: ${r.id}, Student: ${studentName} (${r.student_id}), Status: ${r.status}, Time: ${r.created_at}`);
    });
}
check();
