
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

let supabaseUrl = '';
let supabaseKey = '';

try {
    const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
    const lines = envFile.split('\n');
    for (const line of lines) {
        if (line.trim().startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
            supabaseUrl = line.split('=')[1].replace(/"/g, '').trim();
        }
        if (line.trim().startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
            supabaseKey = line.split('=')[1].replace(/"/g, '').trim();
        }
    }
} catch (e) {
    console.error('Could not read .env.local', e);
}

if (!supabaseUrl || !supabaseKey) { 
    console.error('Missing URL or Key');
    process.exit(1); 
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('Searching for students: 최지후, 김혜원, 한요한');
    const { data: students, error } = await supabase
        .from('students')
        .select('student_id, name, parent_token, grade, class')
        .or('name.eq.최지후,name.eq.김혜원,name.eq.한요한');

    if (error) {
        console.error('Error fetching students:', error);
        return;
    }

    console.log(`Found ${students.length} students.`);
    console.log(JSON.stringify(students, null, 2));

    const tokens = students.map(s => s.parent_token).filter(Boolean);
    
    if (tokens.length > 0) {
        const { data: subs, error: subError } = await supabase
            .from('push_subscriptions')
            .select('*')
            .in('parent_token', tokens);

        if (subError) {
            console.error('Error fetching push subscriptions:', subError);
            return;
        }

        console.log(`\nFound ${subs.length} push subscriptions for these tokens.`);
        
        subs.forEach(sub => {
            const endpoint = typeof sub.subscription_json === 'string' 
                ? JSON.parse(sub.subscription_json).endpoint 
                : sub.subscription_json.endpoint;
            
            const student = students.find(s => s.parent_token === sub.parent_token);
            console.log(`- Token: ${sub.parent_token} (${student ? student.name : 'Unknown'}) -> Endpoint: ${endpoint.substring(0, 50)}...`);
        });
    } else {
        console.log('No parent tokens found for these students.');
    }
}

check();
