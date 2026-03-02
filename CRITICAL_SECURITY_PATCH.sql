-- ==============================================================================
-- 🚨 CRITICAL SECURITY PATCH: KSHS DORM AUTHENTICATION & RLS HARDENING 🚨
-- ==============================================================================
-- NOTE: Please run this entire script in your Supabase SQL Editor immediately.
-- This script secures the database by creating server-side functions for login
-- and completely locking down the authentication tables to prevent data leaks.

-- ------------------------------------------------------------------------------
-- 1. Create Server-Side Authentication Functions (RPCs)
-- ------------------------------------------------------------------------------
-- These functions bypass RLS (SECURITY DEFINER) to check passwords securely
-- without sending the passwords to the client browser.

-- A. Student Login Validation
CREATE OR REPLACE FUNCTION validate_student_login(p_student_id TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_auth_record RECORD;
BEGIN
    SELECT * INTO v_auth_record
    FROM students_auth
    WHERE student_id = p_student_id;

    IF FOUND AND (v_auth_record.password = p_password OR v_auth_record.temp_password = p_password) THEN
        RETURN jsonb_build_object(
            'success', true,
            'must_change_password', v_auth_record.must_change_password
        );
    ELSE
        RETURN jsonb_build_object('success', false);
    END IF;
END;
$$;

-- B. Teacher Login Validation
CREATE OR REPLACE FUNCTION validate_teacher_login(p_teacher_id TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_auth_record RECORD;
BEGIN
    SELECT * INTO v_auth_record
    FROM teachers_auth
    WHERE teacher_id = p_teacher_id;

    IF FOUND AND (v_auth_record.password = p_password OR v_auth_record.temp_password = p_password) THEN
        RETURN jsonb_build_object(
            'success', true,
            'must_change_password', v_auth_record.must_change_password
        );
    ELSE
        RETURN jsonb_build_object('success', false);
    END IF;
END;
$$;

-- C. Monitor Login Validation
CREATE OR REPLACE FUNCTION validate_monitor_login(p_monitor_id TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_auth_record RECORD;
BEGIN
    SELECT * INTO v_auth_record
    FROM monitors_auth
    WHERE monitor_id = p_monitor_id;

    IF FOUND AND (v_auth_record.password = p_password OR v_auth_record.temp_password = p_password) THEN
        RETURN jsonb_build_object('success', true);
    ELSE
        RETURN jsonb_build_object('success', false);
    END IF;
END;
$$;

-- D. Password Change Function
CREATE OR REPLACE FUNCTION change_user_password(p_role TEXT, p_user_id TEXT, p_new_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated INTEGER;
BEGIN
    IF p_role = 'student' THEN
        UPDATE students_auth
        SET temp_password = p_new_password, must_change_password = false
        WHERE student_id = p_user_id;
        GET DIAGNOSTICS v_updated = ROW_COUNT;
    ELSIF p_role = 'teacher' THEN
        UPDATE teachers_auth
        SET temp_password = p_new_password, must_change_password = false
        WHERE teacher_id = p_user_id;
        GET DIAGNOSTICS v_updated = ROW_COUNT;
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid role');
    END IF;

    IF v_updated > 0 THEN
        RETURN jsonb_build_object('success', true);
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;
END;
$$;

-- Grant execution permissions allowing the frontend client to call these functions
GRANT EXECUTE ON FUNCTION validate_student_login(TEXT, TEXT) TO public, anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_teacher_login(TEXT, TEXT) TO public, anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_monitor_login(TEXT, TEXT) TO public, anon, authenticated;
GRANT EXECUTE ON FUNCTION change_user_password(TEXT, TEXT, TEXT) TO public, anon, authenticated;


-- ------------------------------------------------------------------------------
-- 2. Lockdown Row-Level Security (RLS) on Auth Tables
-- ------------------------------------------------------------------------------
-- This is the critical step to stop F12/Network Tab snooping.
-- It ensures that NO direct SELECT/UPDATE commands work from the frontend on these tables.

ALTER TABLE students_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitors_auth ENABLE ROW LEVEL SECURITY;

-- Delete any existing policies that exposed this data to the public
DROP POLICY IF EXISTS "Allow all access to students_auth" ON students_auth;
DROP POLICY IF EXISTS "Allow public select on students_auth" ON students_auth;
DROP POLICY IF EXISTS "Allow teachers to select students_auth" ON students_auth;
DROP POLICY IF EXISTS "Allow all access to teachers_auth" ON teachers_auth;
DROP POLICY IF EXISTS "Allow public select on teachers_auth" ON teachers_auth;
DROP POLICY IF EXISTS "Allow all access to monitors_auth" ON monitors_auth;

-- We DELIBERATELY do not create any new permissive SELECT policies for anon.
-- The RPC functions handle everything internally.

-- ------------------------------------------------------------------------------
-- 3. Confirm RLS on Public Profile Tables
-- ------------------------------------------------------------------------------
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
-- By leaving the standard RLS on but keeping passwords OUT of these tables,
-- dropping down lists of names in the app is safe.
