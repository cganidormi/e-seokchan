-- Add parent_token column to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_token TEXT UNIQUE;

-- Optional: Index on parent_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_students_parent_token ON students(parent_token);
