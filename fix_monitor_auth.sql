-- Ensure monitors_auth table exists and has correct schema
CREATE TABLE IF NOT EXISTS monitors_auth (
  monitor_id TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  room_name TEXT,
  role TEXT DEFAULT 'monitor',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Insert or Update '양현재' account
INSERT INTO monitors_auth (monitor_id, password, room_name)
VALUES ('양현재', '1234', '양현재')
ON CONFLICT (monitor_id) DO UPDATE SET password = '1234';

-- Ensure RLS is handled (either off or with public select for non-sensitive ID check)
ALTER TABLE monitors_auth DISABLE ROW LEVEL SECURITY;
