
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function run() {
    console.log('Testing upsert for 조승연...');
    const { data, error } = await supabase.from('teachers_auth').upsert({
        teacher_id: '조승연',
        temp_password: 'test_password',
        must_change_password: true
    }, { onConflict: 'teacher_id' });

    if (error) {
        console.error('Upsert Error:', error.message);
    } else {
        console.log('Upsert Success!');
    }
}

run();
