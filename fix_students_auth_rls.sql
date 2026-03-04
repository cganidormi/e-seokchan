-- students_auth 테이블에 대한 public 수정 권한 부여 (관리자 페이지 동작용)
-- 보안상 가장 좋은 방법은 admin_roles 등을 체크하는 것이나, 
-- 현재 구조에서는 anon(클라이언트)에서 업데이트를 수행하므로 허용 정책을 추가합니다.

CREATE POLICY "Allow public update to students_auth" ON public.students_auth
FOR UPDATE USING (true);

CREATE POLICY "Allow public insert to students_auth" ON public.students_auth
FOR INSERT WITH CHECK (true);
