const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cosifkjfvmzzfjajnvbg.supabase.co';
const supabaseKey = 'sb_publishable_c2PT4eDVSo3FkBtKo-1Z1g_-kzRSnx3';
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyze() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const { data, error } = await supabase
    .from('leave_requests')
    .select('created_at, leave_type')
    .eq('leave_type', '컴이석')
    .gte('created_at', sevenDaysAgo.toISOString());

  if (error) {
    console.error('Error:', error);
    return;
  }

  const countsByDate = {};
  data.forEach(req => {
    const date = req.created_at.split('T')[0];
    countsByDate[date] = (countsByDate[date] || 0) + 1;
  });

  console.log('Daily "컴이석" Count for the last 7 days:');
  console.log(JSON.stringify(countsByDate, null, 2));
}

analyze();
