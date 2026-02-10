const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
    // This is a bit tricky with only anon key if RLS is on, 
    // but some schemas might be exposed via RPC or we can try to guess.
    // Alternatively, we can use the postgrest 'root' endpoint which sometimes works.

    // Let's try to fetch list of tables via information_schema if enabled,
    // or just try common names.
    const tables = [
        'monitors', 'monitor', 'monitor_auth', 'auth', 'users', 'members'
    ];

    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (!error) console.log(`Table '${table}' exists.`);
        else if (error.code !== '42P01') console.log(`Table '${table}' might exist but:`, error.message);
    }
}

listTables();
