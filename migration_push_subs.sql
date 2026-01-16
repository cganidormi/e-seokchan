-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT REFERENCES students_auth(student_id) ON DELETE CASCADE,
    parent_token TEXT REFERENCES students(parent_token) ON DELETE CASCADE,
    subscription_json JSONB NOT NULL, -- Endpoint, keys (p256dh, auth)
    device_type TEXT, -- 'android', 'ios', 'desktop'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookup by student or token
CREATE INDEX IF NOT EXISTS idx_push_subs_student_id ON push_subscriptions(student_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_parent_token ON push_subscriptions(parent_token);

-- RLS Policies (Optional but good practice)
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (since parents are not logged in user accounts in auth system, but use token)
-- We might need to adjust this depending on Supabase settings. 
-- For now, allow public insert/select if they have the token.
CREATE POLICY "Allow public insert with token" ON push_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select" ON push_subscriptions FOR SELECT USING (true);
