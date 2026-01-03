const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkLeaveSchema() {
    console.log('--- CHECKING LEAVE_REQUESTS SCHEMA ---');
    const { data, error } = await supabase.from('leave_requests').select('*').limit(1);
    if (error) {
        console.log('Error:', error.message);
    } else if (data.length > 0) {
        console.log('Sample Data:', data[0]);
        console.log('ID type check:', typeof data[0].id);
    } else {
        console.log('No data found, checking columns...');
        // If no data, we might need a more advanced way to check type, 
        // but usually just knowing the column names is a start.
        const { data: cols } = await supabase.rpc('get_column_types', { table_name: 'leave_requests' });
        console.log('Column types:', cols);
    }
}

checkLeaveSchema();
