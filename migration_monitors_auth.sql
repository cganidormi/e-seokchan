-- Create monitors_auth table
CREATE TABLE IF NOT EXISTS monitors_auth (
  monitor_id TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  room_name TEXT NOT NULL, -- e.g., '1-1 Study Room'
  role TEXT DEFAULT 'monitor',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Insert initial monitor accounts (example)
INSERT INTO monitors_auth (monitor_id, password, room_name)
VALUES
  ('monitor_1', '1234', '1학년 자습실'),
  ('monitor_2', '1234', '2학년 면학실'),
  ('monitor_3', '1234', '3학년 면학실')
ON CONFLICT (monitor_id) DO NOTHING;

-- Policies (if RLS is enabled, but for now assuming public/anon access for login or handled by backend)
-- We might need RLS if we want strict security, but for now let's just create the table.
