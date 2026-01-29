import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cosifkjfvmzzfjajnvbg.supabase.co';
const supabaseKey = 'sb_publishable_c2PT4eDVSo3FkBtKo-1Z1g_-kzRSnx3';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase.from('leave_requests').select('*').limit(1);
    if (data && data.length > 0) {
        console.log('Keys:', Object.keys(data[0]));
    } else {
        console.log('No data or error:', error);
    }
}

check();
