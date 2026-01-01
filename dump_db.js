const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function dumpData() {
    const { data: requests } = await supabase
        .from('leave_requests')
        .select('*')
        .not('teacher_id', 'is', null)
        .limit(10);

    const { data: teachers } = await supabase
        .from('teachers')
        .select('*');

    const output = {
        requests,
        teachers
    };

    fs.writeFileSync('db_dump.json', JSON.stringify(output, null, 2));
    console.log('Dumped to db_dump.json');
}

dumpData();
