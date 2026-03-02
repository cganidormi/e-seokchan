-- ==============================================================================
-- 🚨 FINAL SECURITY UPDATE: HASH-AWARE AUTHENTICATION RPCs 🚨
-- ==============================================================================
-- Now that the database passwords are encrypted (hashed) with pgcrypto,
-- we must update the login check functions to use the crypt() comparison.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

    IF FOUND THEN
        -- Check if password matches the hash stored in temp_password OR password
        IF (v_auth_record.temp_password IS NOT NULL AND v_auth_record.temp_password = crypt(p_password, v_auth_record.temp_password)) OR
           (v_auth_record.password IS NOT NULL AND v_auth_record.password = crypt(p_password, v_auth_record.password)) THEN
            RETURN jsonb_build_object(
                'success', true,
                'must_change_password', v_auth_record.must_change_password
            );
        END IF;
    END IF;
    
    RETURN jsonb_build_object('success', false);
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

    IF FOUND THEN
        IF (v_auth_record.temp_password IS NOT NULL AND v_auth_record.temp_password = crypt(p_password, v_auth_record.temp_password)) OR
           (v_auth_record.password IS NOT NULL AND v_auth_record.password = crypt(p_password, v_auth_record.password)) THEN
            RETURN jsonb_build_object(
                'success', true,
                'must_change_password', v_auth_record.must_change_password
            );
        END IF;
    END IF;
    
    RETURN jsonb_build_object('success', false);
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

    IF FOUND THEN
        IF (v_auth_record.password IS NOT NULL AND v_auth_record.password = crypt(p_password, v_auth_record.password)) OR
           (v_auth_record.temp_password IS NOT NULL AND v_auth_record.temp_password = crypt(p_password, v_auth_record.temp_password)) THEN
            RETURN jsonb_build_object('success', true);
        END IF;
    END IF;
    
    RETURN jsonb_build_object('success', false);
END;
$$;

-- 4. Password Change Function
CREATE OR REPLACE FUNCTION change_user_password(p_role TEXT, p_user_id TEXT, p_new_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated INTEGER;
BEGIN
    IF p_role = 'student' THEN
        -- Hash the new password before saving it
        UPDATE students_auth
        SET temp_password = crypt(p_new_password, gen_salt('bf', 10)), must_change_password = false
        WHERE student_id = p_user_id;
        GET DIAGNOSTICS v_updated = ROW_COUNT;
        
    ELSIF p_role = 'teacher' THEN
        UPDATE teachers_auth
        SET temp_password = crypt(p_new_password, gen_salt('bf', 10)), must_change_password = false
        WHERE teacher_id = p_user_id;
        GET DIAGNOSTICS v_updated = ROW_COUNT;
        
    ELSIF p_role = 'monitor' THEN
        UPDATE monitors_auth
        SET password = crypt(p_new_password, gen_salt('bf', 10))
        WHERE monitor_id = p_user_id;
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

-- Ensure adequate permissions exist
GRANT EXECUTE ON FUNCTION validate_student_login(TEXT, TEXT) TO public, anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_teacher_login(TEXT, TEXT) TO public, anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_monitor_login(TEXT, TEXT) TO public, anon, authenticated;
GRANT EXECUTE ON FUNCTION change_user_password(TEXT, TEXT, TEXT) TO public, anon, authenticated;
