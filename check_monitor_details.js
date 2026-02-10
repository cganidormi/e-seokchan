const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkMonitorDetails() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    console.log("Checking exact monitor details for '양현재'...");
    const { data: monitor, error } = await supabase.from('monitors_auth').select('*').eq('monitor_id', '양현재').maybeSingle();

    if (error) {
        console.error("Error fetching monitor:", error);
    } else if (monitor) {
        console.log("Monitor Data:", JSON.stringify(monitor, null, 2));
    } else {
        console.log("Monitor '양현재' not found in monitors_auth.");
    }
}

checkMonitorDetails();
