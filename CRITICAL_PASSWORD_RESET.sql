-- ==============================================================================
-- 🚨 CRITICAL SECURITY PATCH: FORCED PASSWORD RESET 🚨
-- ==============================================================================
-- This script resets all passwords to a temporary default and FLAGS ALL USERS
-- to force them to change their passwords immediately upon their next login.

-- 1. Reset Student Passwords
-- We will reset their temp_password to their student_id (학번)
-- and their password to NULL, effectively forcing them through the change password flow.
UPDATE students_auth
SET password = NULL,
    temp_password = student_id,
    must_change_password = true;

-- 2. Reset Teacher Passwords
-- We will reset their temp_password to something default, like their teacher_id (이름)
-- and force a password change.
UPDATE teachers_auth
SET password = NULL,
    temp_password = teacher_id,
    must_change_password = true;

-- 3. Reset Monitor Passwords
-- Monitors might not have a formal password change flow via must_change_password,
-- but we should still reset them. Let's set it to '0000' or their monitor_id as a default.
UPDATE monitors_auth
SET password = NULL,
    temp_password = monitor_id;

-- ==============================================================================
-- INSTRUCTIONS FOR THE TEACHER:
-- 1. Run this script in the Supabase SQL Editor just like you did with the last one.
-- 2. Once executed, ALL previous passwords will be wiped out.
-- 3. Students will now log in using their '학번' (ex: 10101) as both their ID and initial Password.
-- 4. Teachers will log in using their '이름' as both their ID and initial Password.
-- 5. Upon successful login with this temporary password, the system will IMMEDIATELY
--    redirect them to the '비밀번호 변경' (Change Password) page, forcing them to set a new, secure password.
-- ==============================================================================
