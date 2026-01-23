-- 매주 귀가 신청 자동화 테이블 및 함수 생성

-- 1. 월별 매주 귀가 신청자 명단 테이블
create table if not exists monthly_return_applications (
  id uuid default gen_random_uuid() primary key,
  student_id text not null, -- students 테이블의 id가 아니라 text형 student_id일 수 있으므로(기존 코드 참조) fk 제약은 유연하게 둠
  target_year int not null,
  target_month int not null,
  created_at timestamp with time zone default now(),
  unique(student_id, target_year, target_month)
);

-- 2. 자동 반영 로그 테이블 (중복 실행 방지용)
create table if not exists system_sync_logs (
  id uuid default gen_random_uuid() primary key,
  year int not null,
  month int not null,
  synced_at timestamp with time zone default now(),
  unique(year, month)
);

-- 3. 동기화 함수 (Lazy Sync)
-- 교사가 매월 1일 이후 처음 로그인하면 실행됨
create or replace function sync_weekly_returnees(t_year int, t_month int)
returns void as $$
declare
  log_exists boolean;
begin
  -- 1. 이미 반영된 달인지 확인
  select exists(select 1 from system_sync_logs where year = t_year and month = t_month) into log_exists;
  
  if log_exists then
    return; -- 이미 실행했으면 종료
  end if;

  -- 2. 시스템 로그에 먼저 기록 (낙관적 락 역할 겸용)
  -- 트랜잭션 내에서 실행되므로 실패시 롤백됨
  insert into system_sync_logs (year, month) values (t_year, t_month);

  -- 3. 기존 '매주' 설정 초기화
  update students set weekend = false where true;

  -- 4. 신청자 명단 확정 반영
  update students 
  set weekend = true 
  where student_id in (
    select student_id 
    from monthly_return_applications 
    where target_year = t_year and target_month = t_month
  );

end;
$$ language plpgsql security definer;
