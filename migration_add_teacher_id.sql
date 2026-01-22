-- Add teacher_id to push_subscriptions table
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS teacher_id TEXT;
CREATE INDEX IF NOT EXISTS idx_push_subs_teacher_id ON push_subscriptions(teacher_id);
