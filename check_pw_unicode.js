const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkPasswordChars() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data } = await supabase.from('monitors_auth').select('monitor_id, password').eq('monitor_id', '양현재');

    if (data && data.length > 0) {
        const pw = data[0].password;
        const codes = [...pw].map(c => c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
        console.log(`ID: "양현재", PW: "${pw}", PW Chars: ${codes.join(' ')}`);
    } else {
        console.log("No record found for 양현재");
    }
}

checkPasswordChars();
