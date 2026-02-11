
-- Add room_number column to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS room_number INT;

-- Optional: Add index for performance
CREATE INDEX IF NOT EXISTS idx_students_room_number ON students(room_number);
