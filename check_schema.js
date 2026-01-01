const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
    console.log('--- FINDING REQUESTS WITH teacher_id = "서부장" ---');
    const { data: nameMatch, error: e1 } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('teacher_id', '서부장')
        .limit(1);

    if (e1) console.log('Error searching by name "서부장":', e1.message);
    else console.log('Name match result:', nameMatch);

    console.log('--- FINDING REQUESTS WITH ANY non-null teacher_id ---');
    const { data: anyMatch } = await supabase
        .from('leave_requests')
        .select('*')
        .not('teacher_id', 'is', null)
        .limit(5);
    console.log('Any non-null match:', anyMatch);
}

checkSchema();
