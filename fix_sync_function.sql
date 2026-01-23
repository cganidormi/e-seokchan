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

  -- 3. 기존 '매주' 설정 초기화 (Safe Update Bypass: where true 추가)
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
