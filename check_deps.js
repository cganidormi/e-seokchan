const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDependencies() {
    const tables = ['leave_requests', 'seat_assignments', 'students_auth', 'students'];
    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.log(`Table ${table} error: ${error.message}`);
        } else {
            console.log(`Table ${table} columns: ${Object.keys(data[0] || {}).join(', ')}`);
        }
    }
}

checkDependencies();
