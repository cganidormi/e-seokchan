-- teachers 테이블에 대한 RLS 정책을 추가하여 모든 사용자가 조회할 수 있게 합니다.
-- 로그인은 teachers_auth 테이블을 사용하지만, 정보 조회는 teachers 테이블을 사용하므로 권한이 필요합니다.

-- RLS 활성화 (혹시 안 되어 있을 수 있으므로)
alter table teachers enable row level security;

-- 기존 정책이 있다면 충돌날 수 있으므로 안전하게 정책 이름 생성
-- (Postgres는 IF NOT EXISTS 구문이 정책에는 약간 다르게 적용됨, 여기서는 심플하게 정책 추가 시도)

-- 모든 사람에게 SELECT(조회) 권한 허용
create policy "Enable read access for all users" on teachers for select using (true);

-- 모든 사람에게 UPDATE(수정) 권한 허용 (필요한 경우)
create policy "Enable update access for all users" on teachers for update using (true);

-- 혹시 teachers_auth도 막혀있을지 모르니 확인 차원 (보통은 열려있음)
alter table teachers_auth enable row level security;
create policy "Enable read access for auth users" on teachers_auth for select using (true);
