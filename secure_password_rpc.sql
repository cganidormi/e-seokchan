-- Secure Password Change RPC
-- Allows a user to change their password securely without direct table updates from the client

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

GRANT EXECUTE ON FUNCTION change_user_password(TEXT, TEXT, TEXT) TO anon, authenticated;

-- Hardening RLS Policies for Auth Tables
-- Ensure that no one can select from *_auth tables directly from the client.

-- 1. Enable RLS on auth tables if not already enabled
ALTER TABLE students_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitors_auth ENABLE ROW LEVEL SECURITY;

-- 2. Drop any existing permissive policies that might expose auth data
DROP POLICY IF EXISTS "Allow all access to students_auth" ON students_auth;
DROP POLICY IF EXISTS "Allow public select on students_auth" ON students_auth;
DROP POLICY IF EXISTS "Allow teachers to select students_auth" ON students_auth;
DROP POLICY IF EXISTS "Allow all access to teachers_auth" ON teachers_auth;
DROP POLICY IF EXISTS "Allow public select on teachers_auth" ON teachers_auth;
DROP POLICY IF EXISTS "Allow all access to monitors_auth" ON monitors_auth;

-- 3. We do NOT create any SELECT policies for anon/authenticated roles.
-- The RPCs we created are SECURITY DEFINER, so they bypass RLS to perform their checks.
-- This effectively blocks direct client access to passwords while allowing logins.

-- 4. Re-evaluating public tables exposure (students, teachers)
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

-- If they still need to be public for dropdowns, we make sure we ONLY allow SELECT, 
-- and double-check they don't contain sensitive fields (they shouldn't, passwords are in _auth).
-- The current policies `USING (true)` for SELECT on students/teachers are generally okay 
-- IF sensitive data is kept in the `_auth` tables. The major leak was access to the `_auth` tables natively.
