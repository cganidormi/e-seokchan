const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTimetable() {
    const { data, error } = await supabase
        .from('timetable_entries')
        .select('*')
        .order('day_type');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
}

checkTimetable();
