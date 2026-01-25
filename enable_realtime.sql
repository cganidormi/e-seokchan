-- Enable Realtime for critical tables
-- This ensures that INSERT/UPDATE/DELETE events are sent to the client

-- 1. leave_requests (이미 되어있을 수 있지만 확인)
alter publication supabase_realtime add table leave_requests;

-- 2. leave_request_students (이게 누락되었을 가능성 높음)
alter publication supabase_realtime add table leave_request_students;

-- 3. push_subscriptions (알림 디버깅용)
alter publication supabase_realtime add table push_subscriptions;

-- Ensure Replica Identity is set to FULL for junction tables if needed (usually DEFAULT is fine for Insert/Delete, but Update needs Full if no PK)
-- leave_request_students usually has a composite PK or ID. let's assume it's fine.
