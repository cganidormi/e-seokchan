const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function findYanghyeonjaeData() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    console.log("Checking students for room/assignment clues...");
    // Find any student named or associated with 양현재 if it exists in students table
    const { data: students } = await supabase.from('students').select('*').limit(10);
    // Well, students might not have room info directly. Check seat_assignments.

    console.log("Listing room_layouts...");
    const { data: layouts } = await supabase.from('room_layouts').select('*');
    console.log("Layouts:", JSON.stringify(layouts));

    console.log("Checking assignments for any clue...");
    const { data: assignments } = await supabase.from('seat_assignments').select('*, students(name)').limit(5);
    console.log("Assignments (sample):", JSON.stringify(assignments));
}

findYanghyeonjaeData();
