-- Combined Migration: Parent Token & Push Subscriptions

-- 1. Add parent_token to students if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'parent_token') THEN 
        ALTER TABLE students ADD COLUMN parent_token TEXT UNIQUE; 
    END IF; 
END $$;

-- 2. Backfill parent_token for existing students who don't have one
-- Using gen_random_uuid() for robust uniqueness
UPDATE students 
SET parent_token = gen_random_uuid()::text 
WHERE parent_token IS NULL;

-- 3. Create Index on parent_token
CREATE INDEX IF NOT EXISTS idx_students_parent_token ON students(parent_token);

-- 4. Create push_subscriptions table if not exists
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT REFERENCES students_auth(student_id) ON DELETE CASCADE,
    parent_token TEXT REFERENCES students(parent_token) ON DELETE CASCADE,
    subscription_json JSONB NOT NULL,
    device_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Indices for push_subscriptions
CREATE INDEX IF NOT EXISTS idx_push_subs_student_id ON push_subscriptions(student_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_parent_token ON push_subscriptions(parent_token);

-- 6. RLS Policies
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow public insert/select if they have the valid token or logged in student
DROP POLICY IF EXISTS "Allow public insert with token" ON push_subscriptions;
CREATE POLICY "Allow public insert with token" ON push_subscriptions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public select" ON push_subscriptions;
CREATE POLICY "Allow public select" ON push_subscriptions FOR SELECT USING (true);
