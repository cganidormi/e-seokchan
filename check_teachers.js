const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    const { data, count, error } = await supabase
        .from('teachers')
        .select('*', { count: 'exact' });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('총 교사 수:', count);
    console.log('\n첫 10명의 교사 데이터:');
    data.slice(0, 10).forEach((teacher, idx) => {
        console.log(`${idx + 1}. ID: ${teacher.teacher_id}, 이름: ${teacher.name}`);
    });

    if (count > 10) {
        console.log(`\n... 그 외 ${count - 10}명 더 있음`);
    }
}

run();
