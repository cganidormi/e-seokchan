const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    console.log('빈 교사 데이터를 삭제합니다...\n');

    // teacher_id가 null이거나 빈 문자열인 행 삭제
    const { data: deleted, error } = await supabase
        .from('teachers')
        .delete()
        .or('teacher_id.is.null,teacher_id.eq.,name.is.null,name.eq.')
        .select();

    if (error) {
        console.error('삭제 실패:', error);
        return;
    }

    console.log(`${deleted?.length || 0}개의 빈 데이터를 삭제했습니다.`);

    // 남은 교사 수 확인
    const { count } = await supabase
        .from('teachers')
        .select('*', { count: 'exact', head: true });

    console.log(`\n남은 교사 수: ${count}명`);

    // 남은 교사 목록 출력
    const { data: remaining } = await supabase
        .from('teachers')
        .select('*');

    console.log('\n남은 교사 목록:');
    remaining?.forEach((teacher, idx) => {
        console.log(`${idx + 1}. ID: ${teacher.teacher_id}, 이름: ${teacher.name}`);
    });
}

run();
