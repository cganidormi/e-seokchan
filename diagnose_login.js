const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser(id) {
    console.log(`Checking for ID: ${id}`);

    // Check students_auth
    const { data: student } = await supabase.from('students_auth').select('*').eq('student_id', id).maybeSingle();
    if (student) console.log('Found in students_auth:', student.student_id);

    // Check teachers_auth
    const { data: teacher } = await supabase.from('teachers_auth').select('*').eq('teacher_id', id).maybeSingle();
    if (teacher) console.log('Found in teachers_auth:', teacher.teacher_id);

    // Check monitors_auth
    const { data: monitor } = await supabase.from('monitors_auth').select('*').eq('monitor_id', id).maybeSingle();
    if (monitor) console.log('Found in monitors_auth:', monitor.monitor_id);

    if (!student && !teacher && !monitor) console.log('Not found in any auth table.');
}

checkUser('양현재');
