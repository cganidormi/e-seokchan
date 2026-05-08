
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
let env = '';
try { env = fs.readFileSync('.env.local', 'utf8'); } catch(e) {}
const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const key = (env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();
const supabase = createClient(url, key);

async function check() {
    const { data, error } = await supabase.from('system_sync_logs').select('*');
    if (error) { console.error(error); return; }
    
    console.log('--- System Sync Logs ---');
    data.forEach(l => {
        console.log(`Year: ${l.year}, Month: ${l.month}, Synced At: ${l.synced_at}`);
    });
}
check();
