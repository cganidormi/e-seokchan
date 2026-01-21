-- Migration: Force Fix Status Constraints
-- Run this in Supabase SQL Editor

-- 1. Ensure the parent_approval_status column exists
ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS parent_approval_status TEXT DEFAULT 'pending';

-- 2. Force drop ALL check constraints on the 'status' column
-- This block finds any check constraint that references the 'status' column and drops it.
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN 
        SELECT con.conname 
        FROM pg_catalog.pg_constraint con
        INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = connamespace
        WHERE nsp.nspname = 'public'
        AND rel.relname = 'leave_requests'
        AND con.contype = 'c'  -- Check constraint
        AND pg_get_constraintdef(con.oid) LIKE '%status%' -- Checks referencing 'status'
    LOOP 
        EXECUTE 'ALTER TABLE public.leave_requests DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP; 
END $$;

-- 3. Ensure status column is TEXT (removes Enum limitations if any)
ALTER TABLE leave_requests ALTER COLUMN status TYPE TEXT;
