const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const nowStr = new Date().toISOString();

  const { data, error } = await supabase
    .from('leave_requests')
    .select('id, leave_type, status, created_at, end_time')
    .or(`end_time.gte.${nowStr},created_at.gte.${threeDaysAgo},status.in.(신청,학부모승인대기,학부모승인,승인대기)`)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) console.error('Error:', error);
  else console.log('Success, found:', data.length, data);
}

test();
