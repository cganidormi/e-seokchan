
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function run() {
    try {
        const env = fs.readFileSync('.env.local', 'utf8');
        const lines = env.split('\n');
        let url = '';
        let key = '';

        for (const line of lines) {
            if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
                url = line.split('=')[1].trim();
            }
            if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
                key = line.split('=')[1].trim();
            }
        }

        if (!url || !key) {
            console.error('Missing URL or Key in .env.local');
            return;
        }

        const supabase = createClient(url, key);

        console.log('--- Database Column check ---');

        const { data: tData, error: tError } = await supabase.from('teachers_auth').select('*').limit(1);
        if (tError) {
            console.error('Error fetching teachers_auth:', tError.message);
        } else if (tData && tData.length > 0) {
            console.log('teachers_auth columns:', Object.keys(tData[0]).join(', '));
        } else {
            console.log('teachers_auth: No data found');
        }

        const { data: sData, error: sError } = await supabase.from('students_auth').select('*').limit(1);
        if (sError) {
            console.error('Error fetching students_auth:', sError.message);
        } else if (sData && sData.length > 0) {
            console.log('students_auth columns:', Object.keys(sData[0]).join(', '));
        } else {
            console.log('students_auth: No data found');
        }

    } catch (e) {
        console.error('Script Error:', e.message);
    }
}

run();
