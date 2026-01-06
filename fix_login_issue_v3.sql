-- 로그인 인증을 위한 테이블들에 대한 접근 권한을 허용합니다.
-- 이 스크립트는 학생들이나 교사가 로그인을 시도할 때 계정 정보를 찾을 수 있게 해줍니다.

-- 1. Students Auth (학생 로그인 정보)
alter table students_auth enable row level security;
-- 기존 정책 제거 (충돌 방지)
drop policy if exists "Enable read access for all users" on students_auth;
-- 정책 생성
create policy "Enable read access for all users" on students_auth for select using (true);

-- 2. Teachers Auth (교사 로그인 정보)
alter table teachers_auth enable row level security;
-- 기존 정책 제거
drop policy if exists "Enable read access for all users" on teachers_auth;
-- 정책 생성
create policy "Enable read access for all users" on teachers_auth for select using (true);

-- 3. Students (학생 정보 - 추가 안전장치)
alter table students enable row level security;
drop policy if exists "Enable read access for all users" on students;
create policy "Enable read access for all users" on students for select using (true);
