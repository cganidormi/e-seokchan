-- [문제 해결] 일과표 저장 권한 설정
-- 관리자 페이지에서 일과표 수정 후 "저장되었습니다"라고 뜨지만, 새로고침하면 원래대로 돌아가는 문제 해결용입니다.
-- 이 SQL을 Supabase 대시보드의 SQL Editor에서 실행하세요.

-- 1. RLS(행 수준 보안) 활성화 확인
ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;

-- 2. 기존 정책 정리 (중복 방지)
DROP POLICY IF EXISTS "Allow all access to timetable_entries" ON timetable_entries;
DROP POLICY IF EXISTS "Enable all access for timetable_entries" ON timetable_entries;
DROP POLICY IF EXISTS "Allow read access to timetable_entries" ON timetable_entries;
DROP POLICY IF EXISTS "Allow update for timetable_entries" ON timetable_entries;

-- 3. 모든 권한 허용 정책 생성 (가장 확실한 해결책)
-- 주의: 실제 서비스 운영 시에는 관리자만 수정 가능하도록 제한하는 것이 좋으나, 현재는 기능 정상화가 우선이므로 전체 허용합니다.
CREATE POLICY "Enable all access for timetable_entries"
ON timetable_entries
FOR ALL
USING (true)
WITH CHECK (true);

-- 4. 확인용 메시지 출력 (SQL 실행 결과 탭에서 확인 가능)
DO $$
BEGIN
  RAISE NOTICE 'timetable_entries 테이블 권한 설정이 완료되었습니다.';
END $$;
