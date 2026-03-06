
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function run() {
    try {
        const env = fs.readFileSync('.env.local', 'utf8');
        const url = env.split('\n').find(l => l.includes('NEXT_PUBLIC_SUPABASE_URL')).split('=')[1].trim();
        const key = env.split('\n').find(l => l.includes('SUPABASE_SERVICE_ROLE_KEY')).split('=')[1].trim();

        const supabase = createClient(url, key);

        const { data: tData } = await supabase.from('teachers_auth').select('*').limit(1);
        const { data: sData } = await supabase.from('students_auth').select('*').limit(1);

        console.log('--- AUDIT RESULTS ---');
        console.log('teachers_auth columns:', tData && tData.length > 0 ? Object.keys(tData[0]) : 'Empty');
        console.log('students_auth columns:', sData && sData.length > 0 ? Object.keys(sData[0]) : 'Empty');
    } catch (e) {
        console.error('Audit failed:', e.message);
    }
}
run();
