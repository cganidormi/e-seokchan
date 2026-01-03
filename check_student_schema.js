const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
    console.log('--- CHECKING STUDENTS SCHEMA ---');
    const { data, error } = await supabase.from('students').select('*').limit(1);
    if (error) console.log('Error:', error.message);
    else console.log('Columns:', Object.keys(data[0] || {}));
}

checkSchema();
