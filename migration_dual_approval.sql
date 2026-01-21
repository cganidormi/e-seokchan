-- Migration: Dual Approval (parent_approval_status)

-- 1. Add parent_approval_status column to leave_requests
ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS parent_approval_status TEXT DEFAULT 'pending';

-- 2. Comment on column (Optional documentation)
COMMENT ON COLUMN leave_requests.parent_approval_status IS 'Status of parent approval: pending, approved, rejected';
