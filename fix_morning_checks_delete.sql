-- Fix RLS for morning_checks to allow public deletion
-- This ensures that teachers/admins can delete records using the anonymous client if they have access.

DROP POLICY IF EXISTS "Allow all access to morning_checks" ON morning_checks;
DROP POLICY IF EXISTS "Public read for teachers" ON morning_checks;
DROP POLICY IF EXISTS "Public insert for teachers" ON morning_checks;

-- Create a comprehensive policy for all operations
CREATE POLICY "Allow all access to morning_checks" ON morning_checks 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE morning_checks ENABLE ROW LEVEL SECURITY;
