-- Migration: Fix Status Constraint & Add Dual Approval Column
-- Run this in Supabase SQL Editor

-- 1. Add parent_approval_status column if it doesn't exist
ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS parent_approval_status TEXT DEFAULT 'pending';

-- 2. Drop Check Constraint on status if it exists
-- (This removes the restriction that status must be '신청', '승인', '반려' etc.)
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'leave_requests_status_check' 
        AND table_name = 'leave_requests'
    ) THEN 
        ALTER TABLE leave_requests DROP CONSTRAINT leave_requests_status_check; 
    END IF; 
END $$;

-- 3. If there is no named constraint but an implicit one or different name, 
-- you might need to inspect the table definition. 
-- Or simply alter the column type to TEXT to be safe (if it was an enum/domain)
ALTER TABLE leave_requests ALTER COLUMN status TYPE TEXT;
