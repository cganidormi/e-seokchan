const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debug() {
    console.log('--- TEACHERS ---');
    const { data: teachers, error: tError } = await supabase.from('teachers').select('*');
    if (tError) console.error(tError);
    else console.log(JSON.stringify(teachers, null, 2));

    console.log('\n--- LEAVE REQUESTS (last 5) ---');
    const { data: requests, error: rError } = await supabase
        .from('leave_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
    if (rError) console.error(rError);
    else console.log(JSON.stringify(requests, null, 2));
}

debug();
