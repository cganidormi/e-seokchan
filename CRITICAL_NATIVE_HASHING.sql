-- 1. 암호화 필수 엔진 켜기
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. 학생 비밀번호 해시 (temp_password 컬럼 업데이트)
UPDATE students_auth
SET temp_password = crypt(temp_password, gen_salt('bf', 10))
WHERE temp_password IS NOT NULL AND temp_password NOT LIKE '$2a$%' AND temp_password NOT LIKE '$2b$%';

-- 3. 교사 비밀번호 해시 (temp_password 컬럼 업데이트)
UPDATE teachers_auth
SET temp_password = crypt(temp_password, gen_salt('bf', 10))
WHERE temp_password IS NOT NULL AND temp_password NOT LIKE '$2a$%' AND temp_password NOT LIKE '$2b$%';

-- 4. 사생장 비밀번호 해시 (password 컬럼 업데이트)
UPDATE monitors_auth
SET password = crypt(password, gen_salt('bf', 10))
WHERE password IS NOT NULL AND password NOT LIKE '$2a$%' AND password NOT LIKE '$2b$%';
