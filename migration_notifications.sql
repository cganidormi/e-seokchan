-- 1. Push Subscriptions Table (Skipping as it already exists)
-- If you need to ensure it exists, the previous error confirms it does.

-- 2. Notification Logs Table (Prevention of duplicate sends)
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_date DATE NOT NULL, -- The date the notification is for (e.g., 2024-03-10)
    notification_type TEXT NOT NULL, -- 'period_start', 'period_end'
    sent_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(target_date, notification_type)
);

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (teachers) to read/insert logs
-- Using DO block to avoid "policy already exists" errors if re-run
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'notification_logs' AND policyname = 'Allow teachers insert logs'
    ) THEN
        CREATE POLICY "Allow teachers insert logs" ON notification_logs FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'notification_logs' AND policyname = 'Allow teachers select logs'
    ) THEN
        CREATE POLICY "Allow teachers select logs" ON notification_logs FOR SELECT USING (true);
    END IF;
END
$$;
