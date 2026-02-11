-- Enable RLS on students table (if not already enabled)
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Create policy to allow ALL operations on students table for ALL users (public/anon)
-- This is necessary because we are currently missing the SUPABASE_SERVICE_ROLE_KEY environment variable.
-- WARNING: This allows anyone with the anon key (public) to modify student data. 
-- In a production environment, you should use the Service Role Key or authenticated user policies.

CREATE POLICY "Allow public update access to students" 
ON students 
FOR ALL 
USING (true) 
WITH CHECK (true);
