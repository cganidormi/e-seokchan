const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function searchString(str) {
    console.log(`Searching for string: ${str}`);

    // Search in teachers
    const { data: teachers } = await supabase.from('teachers').select('*');
    if (teachers) {
        const match = teachers.find(t => Object.values(t).some(val => String(val).includes(str)));
        if (match) console.log('Found match in teachers:', JSON.stringify(match));
    }

    // Search in students
    const { data: students } = await supabase.from('students').select('*');
    if (students) {
        const match = students.find(s => Object.values(s).some(val => String(val).includes(str)));
        if (match) console.log('Found match in students:', JSON.stringify(match));
    }
}

searchString('양현재');
