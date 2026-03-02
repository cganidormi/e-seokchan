const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Missing Supabase credentials in .env.local');
    process.exit(1);
}

// We must use the service role key to bypass RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function hashPasswordsForTable(tableName, idColumn) {
    console.log(`\n--- Processing table: ${tableName} ---`);

    // 1. Fetch all records. Note: fetching password and temp_password directly from main table
    const { data: records, error: fetchError } = await supabaseAdmin
        .from(tableName)
        .select(`${idColumn}, password, temp_password`);

    if (fetchError) {
        if (fetchError.code === '42703') {
            console.warn(`[SKIP] Columns might not exist in ${tableName} - ${fetchError.message}`);
        } else {
            console.error(`Error fetching records from ${tableName}:`, fetchError);
        }
        return;
    }

    console.log(`Found ${records.length} records in ${tableName}.`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const record of records) {
        const id = record[idColumn];
        let needsUpdate = false;
        const updates = {};

        // Check main password
        if (record.password) {
            if (typeof record.password === 'string' && (record.password.startsWith('$2a$') || record.password.startsWith('$2b$'))) {
                // Already hashed
            } else {
                updates.password = await bcrypt.hash(String(record.password), 10);
                needsUpdate = true;
            }
        }

        // Check temp password
        if (record.temp_password) {
            if (typeof record.temp_password === 'string' && (record.temp_password.startsWith('$2a$') || record.temp_password.startsWith('$2b$'))) {
                // Already hashed
            } else {
                updates.temp_password = await bcrypt.hash(String(record.temp_password), 10);
                needsUpdate = true;
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
    console.log('Starting password hash migration (targeting MAIN tables)...');

    // The schema stores credentials directly on the main tables, not on _auth tables
    await hashPasswordsForTable('students', 'student_id');
    await hashPasswordsForTable('teachers', 'teacher_id');
    await hashPasswordsForTable('monitors', 'monitor_id');

    console.log('\nMigration entirely complete!\n🚨 PLEASE ENSURE THE FRONTEND IS DEPLOYED BEFORE DOING THIS OR NO ONE WILL BE ABLE TO LOG IN 🚨');
}

runMigration();
