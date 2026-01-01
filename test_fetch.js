const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFetch() {
    const id = '0ba2dfb8-b5d5-419f-a465-5dac069770c9'; // 서부장 UUID
    const name = '서부장';

    console.log('--- TEST 1: in([UUID, Name]) ---');
    const { data: d1, error: e1 } = await supabase
        .from('leave_requests')
        .select('*')
        .in('teacher_id', [id, name]);
    if (e1) console.log('Test 1 Failed:', e1.message);
    else console.log('Test 1 Success, found:', d1.length);

    console.log('\n--- TEST 2: eq(UUID) ---');
    const { data: d2, error: e2 } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('teacher_id', id);
    if (e2) console.log('Test 2 Failed:', e2.message);
    else console.log('Test 2 Success, found:', d2.length);

    console.log('\n--- TEST 3: eq(Name) ---');
    const { data: d3, error: e3 } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('teacher_id', name);
    if (e3) console.log('Test 3 Failed:', e3.message);
    else console.log('Test 3 Success, found:', d3.length);
}

testFetch();
