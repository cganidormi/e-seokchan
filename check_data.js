const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkStudentLeaves() {
    const students = ['이병헌', '홍길동'];
    console.log(`Checking leaves for: ${students.join(', ')}`);

    const { data: studentRecords } = await supabase.from('students').select('*').in('name', students);
    if (!studentRecords) return;

    const studentIds = studentRecords.map(s => s.student_id);

    const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .in('student_id', studentIds)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error(error);
        return;
    }

    console.log(JSON.stringify(data, null, 2));
}

checkStudentLeaves();
