const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function searchEverywhere() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const tables = [
        'students', 'students_auth', 'teachers', 'teachers_auth',
        'monitors_auth', 'monitors', 'users', 'staff'
    ];

    console.log("Searching for '양현재'...");
    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*');
        if (data) {
            const matches = data.filter(row =>
                Object.values(row).some(val => String(val).includes('양현재'))
            );
            if (matches.length > 0) {
                console.log(`[FOUND in ${table}]`, JSON.stringify(matches));
            }
        }
    }
}

searchEverywhere();
