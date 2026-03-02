-- Secure Authentication RPCs
-- This script creates server-side functions to validate credentials without exposing them to the client.

-- 1. Student Login Validation
CREATE OR REPLACE FUNCTION validate_student_login(p_student_id TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Allows the function to bypass RLS to check the password
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

-- 2. Teacher Login Validation
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

-- 3. Monitor Login Validation
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

-- Grant execution permissions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION validate_student_login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_teacher_login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_monitor_login(TEXT, TEXT) TO anon, authenticated;
