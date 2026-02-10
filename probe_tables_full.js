const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function listAllTables() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    // Probing for table names by trying to select from them
    // We can also try to guess based on common patterns if information_schema is restricted
    const commonTableNames = [
        'students', 'students_auth', 'teachers', 'teachers_auth',
        'monitors', 'monitors_auth', 'monitor', 'monitor_auth',
        'users', 'user_auth', 'accounts', 'staff', 'admin_auth',
        'leave_requests', 'seat_assignments', 'room_layouts',
        'timetable_entries', 'special_holidays', 'parents', 'push_subscriptions'
    ];

    console.log("Probing tables...");
    for (const name of commonTableNames) {
        const { error } = await supabase.from(name).select('*').limit(1);
        if (!error) {
            console.log(`[EXIST] ${name}`);
        } else if (error.code !== '42P01') {
            console.log(`[MIGHT EXIST] ${name} (Error: ${error.code} - ${error.message})`);
        }
    }
}

listAllTables();
