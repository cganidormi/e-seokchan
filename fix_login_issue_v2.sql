-- 모든 테이블에 대한 RLS 정책을 확실하게 엽니다.
-- 교사와 학생 로그인 유지 문제, 데이터 로딩 실패 문제를 해결합니다.

-- 1. Teachers
alter table teachers enable row level security;
drop policy if exists "Enable read access for all users" on teachers;
create policy "Enable read access for all users" on teachers for select using (true);

-- 2. Students
alter table students enable row level security;
drop policy if exists "Enable read access for all users" on students;
create policy "Enable read access for all users" on students for select using (true);

-- 3. Leave Requests (이석 신청)
alter table leave_requests enable row level security;
drop policy if exists "Enable read access for all users" on leave_requests;
drop policy if exists "Enable insert access for all users" on leave_requests;
drop policy if exists "Enable update access for all users" on leave_requests;

create policy "Enable read access for all users" on leave_requests for select using (true);
create policy "Enable insert access for all users" on leave_requests for insert with check (true);
create policy "Enable update access for all users" on leave_requests for update using (true);

-- 4. Leave Request Students (이석-학생 연결)
alter table leave_request_students enable row level security;
drop policy if exists "Enable read access for all users" on leave_request_students;
drop policy if exists "Enable insert access for all users" on leave_request_students;
drop policy if exists "Enable delete access for all users" on leave_request_students;

create policy "Enable read access for all users" on leave_request_students for select using (true);
create policy "Enable insert access for all users" on leave_request_students for insert with check (true);
create policy "Enable delete access for all users" on leave_request_students for delete using (true);

-- 5. Special Holidays
alter table special_holidays enable row level security;
drop policy if exists "Enable read access for all users" on special_holidays;
create policy "Enable read access for all users" on special_holidays for select using (true);
