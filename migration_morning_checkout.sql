-- Create table for morning checkout logs
CREATE TABLE IF NOT EXISTS morning_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT NOT NULL REFERENCES students_auth(student_id) ON DELETE CASCADE,
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    teacher_id TEXT, -- Optional: who checked
    type TEXT DEFAULT 'late', -- 'late' (지각), 'cleaning' (청소불량) etc.
    note TEXT
);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_morning_checks_date ON morning_checks(checked_at);
CREATE INDEX IF NOT EXISTS idx_morning_checks_student ON morning_checks(student_id);

-- RLS
ALTER TABLE morning_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read for teachers" ON morning_checks FOR SELECT USING (true);
CREATE POLICY "Public insert for teachers" ON morning_checks FOR INSERT WITH CHECK (true);
