
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
    console.log('Searching for students: 최지후, 김혜원, 한요한');
    const { data: students, error } = await supabase
        .from('students')
        .select('*')
        .or('name.eq.최지후,name.eq.김혜원,name.eq.한요한');

    if (error) {
        console.error('Error fetching students:', error);
        return;
    }

    console.log(`Found ${students.length} students.`);
    console.log(JSON.stringify(students.map(s => ({
        student_id: s.student_id,
        name: s.name,
        grade: s.grade,
        class: s.class,
        parent_token: s.parent_token ? 'EXISTS' : 'MISSING'
    })), null, 2));

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
        
        // Group by subscription_json to see if any device appears multiple times
        const deviceMap = new Map();
        subs.forEach(sub => {
            const endpoint = typeof sub.subscription_json === 'string' 
                ? JSON.parse(sub.subscription_json).endpoint 
                : sub.subscription_json.endpoint;
            
            if (!deviceMap.has(endpoint)) {
                deviceMap.set(endpoint, []);
            }
            deviceMap.get(endpoint).push(sub.parent_token);
        });

        console.log('\nDevice Subscription Analysis:');
        deviceMap.forEach((parentTokens, endpoint) => {
            if (parentTokens.length > 1) {
                console.log(`Endpoint ${endpoint.substring(0, 30)}... is linked to:`);
                parentTokens.forEach(t => {
                    const student = students.find(s => s.parent_token === t);
                    console.log(` - ${student ? student.name : 'Unknown'} (token: ${t})`);
                });
            } else {
                const student = students.find(s => s.parent_token === parentTokens[0]);
                console.log(`Endpoint ${endpoint.substring(0, 30)}... is linked to: ${student ? student.name : 'Unknown'}`);
            }
        });
    } else {
        console.log('No parent tokens found for these students.');
    }
}

check();
