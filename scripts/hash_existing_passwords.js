const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function hashPasswordsForTable(tableName, idColumn, passwordColumns) {
    console.log(`\n--- Processing table: ${tableName} ---`);

    const selectColumns = [idColumn, ...passwordColumns].join(', ');

    const { data: records, error: fetchError } = await supabaseAdmin
        .from(tableName)
        .select(selectColumns);

    if (fetchError) {
        console.error(`Error fetching records from ${tableName}:`, fetchError);
        return;
    }

    console.log(`Found ${records.length} records in ${tableName}.`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const record of records) {
        const id = record[idColumn];
        let needsUpdate = false;
        const updates = {};

        for (const pwCol of passwordColumns) {
            const pwValue = record[pwCol];
            if (pwValue && typeof pwValue === 'string') {
                if (pwValue.startsWith('$2a$') || pwValue.startsWith('$2b$')) {
                    // Already hashed
                } else {
                    updates[pwCol] = await bcrypt.hash(pwValue, 10);
                    needsUpdate = true;
                }
            }
        }

        if (needsUpdate) {
            const { error: updateError } = await supabaseAdmin
                .from(tableName)
                .update(updates)
                .eq(idColumn, id);

            if (updateError) {
                console.error(`Failed to update ${id} in ${tableName}:`, updateError);
            } else {
                updatedCount++;
            }
        } else {
            skippedCount++;
        }
    }

    console.log(`Completed ${tableName}: Updated ${updatedCount}, Skipped (already hashed or no password) ${skippedCount}.`);
}

async function runMigration() {
    console.log('Starting password hash migration...');

    // As discovered, students/teachers use temp_password as the main password column. Monitors use password.
    await hashPasswordsForTable('students_auth', 'student_id', ['temp_password']);
    await hashPasswordsForTable('teachers_auth', 'teacher_id', ['temp_password']);
    await hashPasswordsForTable('monitors_auth', 'monitor_id', ['password']);

    console.log('\nMigration entirely complete!\n🚨 PLEASE ENSURE THE FRONTEND IS DEPLOYED BEFORE DOING THIS OR NO ONE WILL BE ABLE TO LOG IN 🚨');
}

runMigration();
