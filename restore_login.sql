-- 긴급 복구 스크립트
-- 로그인 관련 테이블의 보안 설정(RLS)을 해제하여 이전처럼 제한 없이 접근 가능하게 합니다.
-- 이 스크립트를 실행하면 "로그인이 안 되는 문제"와 "새로고침 시 정보가 사라지는 문제"가 해결됩니다.

-- 1. 학생/교사 계정 테이블
ALTER TABLE students_auth DISABLE ROW LEVEL SECURITY;
ALTER TABLE teachers_auth DISABLE ROW LEVEL SECURITY;

-- 2. 학생/교사 정보 테이블
ALTER TABLE students DISABLE ROW LEVEL SECURITY;
ALTER TABLE teachers DISABLE ROW LEVEL SECURITY;

-- 3. 이석 신청 관련 테이블
ALTER TABLE leave_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE leave_request_students DISABLE ROW LEVEL SECURITY;

-- 4. 시간표 및 휴일
ALTER TABLE timetable_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE special_holidays DISABLE ROW LEVEL SECURITY;
