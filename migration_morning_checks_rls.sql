-- Ensure morning_checks table exists (idempotent check is hard in pure SQL without PL/PGSQL, but assuming it exists as per user)
-- Enable RLS
ALTER TABLE morning_checks ENABLE ROW LEVEL SECURITY;

-- Create Policy for SELECT (Allow all authenticated/anon for now, or just public)
-- This matches the pattern in db_setup.sql
CREATE POLICY "Allow all access to morning_checks" ON morning_checks FOR ALL USING (true) WITH CHECK (true);
