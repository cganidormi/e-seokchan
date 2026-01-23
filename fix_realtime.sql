-- 실시간 연동이 작동하지 않는 경우 실행해주세요.

-- 1. `monthly_return_applications` 테이블을 실시간 감시 목록에 추가
-- (새로 만든 테이블은 기본적으로 실시간 감시가 꺼져 있어, 추가해 주어야 구독이 가능합니다)
alter publication supabase_realtime add table monthly_return_applications;

-- 2. (참고) 권한 설정 확인
-- 테이블에 RLS(Row Level Security)가 켜져 있다면 정책이 필요하지만, 
-- 아까 생성한 SQL에는 RLS 설정이 없었으므로 기본적으로 꺼져 있어 위 명령어만으로 충분할 것입니다.
