const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Note: Ideally we use SERVICE_ROLE_KEY for full access dump, but anon key might suffice for readable data if RLS allows.
// However, for a true admin dump, we need the service role key.
// Let's try to read from env or strict prompt.
// For now, we will use the SERVICE_ROLE which should be in .env.local if available, or fall back to known keys.

const supabase = createClient(supabaseUrl, supabaseKey);

async function backupData() {
    console.log("Starting Backup...");
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const tables = ['students', 'teachers', 'room_assignments', 'leave_requests', 'points_log', 'notifications'];

    let completeBackup = {};

    for (const table of tables) {
        console.log(`Backing up table: ${table}...`);
        const { data, error } = await supabase.from(table).select('*');
        if (error) {
            console.error(`Error backing up ${table}:`, error.message);
        } else {
            completeBackup[table] = data;
            console.log(` - ${table}: ${data.length} records saved.`);
        }
    }

    const backupFile = path.join(backupDir, `data_backup_${timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(completeBackup, null, 2));
    console.log(`✅ Data Backup completed: ${backupFile}`);
}

backupData();
