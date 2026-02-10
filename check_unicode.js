const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkExactChars() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data } = await supabase.from('monitors_auth').select('monitor_id');

    if (data) {
        data.forEach(m => {
            const id = m.monitor_id;
            const codes = [...id].map(c => c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
            console.log(`ID: "${id}", Chars: ${codes.join(' ')}`);
        });
    }
}

checkExactChars();
