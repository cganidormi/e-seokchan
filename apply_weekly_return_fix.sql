-- 매주 귀가 신청 로직 고도화: '유지(Persistence)' 방식 도입

-- 1. 테이블에 명시적 상태 컬럼 추가 (true: 매주로 변경, false: 격주로 변경)
ALTER TABLE monthly_return_applications ADD COLUMN IF NOT EXISTS is_weekly BOOLEAN DEFAULT TRUE;

-- 2. 동기화 함수 수정 (전체 초기화 삭제 및 변경분만 반영)
CREATE OR REPLACE FUNCTION sync_weekly_returnees(t_year INT, t_month INT)
RETURNS VOID AS $$
DECLARE
  log_exists BOOLEAN;
BEGIN
  -- 1. 이미 반영된 달인지 확인
  SELECT EXISTS(SELECT 1 FROM system_sync_logs WHERE year = t_year AND month = t_month) INTO log_exists;
  
  IF log_exists THEN
    RETURN; -- 이미 실행했으면 종료
  END IF;

  -- 2. 시스템 로그에 기록
  INSERT INTO system_sync_logs (year, month) VALUES (t_year, t_month);

  -- 3. [개선됨] 전체 초기화(weekend = false) 과정을 삭제합니다.
  -- 이제 기존의 weekend 상태가 다음 달로 그대로 승계됩니다.

  -- 4. [개선됨] 신청자 명단의 '변경 사항'만 반영합니다.
  -- is_weekly가 true인 학생은 매주귀가로, false인 학생은 격주귀가로 변경됩니다.
  
  -- 매주귀가로 변경
  UPDATE students 
  SET weekend = TRUE 
  WHERE student_id IN (
    SELECT student_id 
    FROM monthly_return_applications 
    WHERE target_year = t_year AND target_month = t_month AND is_weekly = TRUE
  );

  -- 격주귀가로 변경
  UPDATE students 
  SET weekend = FALSE 
  WHERE student_id IN (
    SELECT student_id 
    FROM monthly_return_applications 
    WHERE target_year = t_year AND target_month = t_month AND is_weekly = FALSE
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
