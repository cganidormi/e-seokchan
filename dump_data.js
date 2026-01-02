const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    const { data } = await supabase.from('timetable_entries').select('*');
    fs.writeFileSync('timetable.json', JSON.stringify(data, null, 2));

    const { data: leaves } = await supabase.from('leave_requests').select('id, student_id, leave_type, period, end_time, status').eq('status', '승인').order('created_at', { ascending: false }).limit(20);
    fs.writeFileSync('leaves.json', JSON.stringify(leaves, null, 2));
}

run();
