-- 취소(삭제) 시에도 실시간 연동이 되도록 설정

-- 기본적으로 삭제 이벤트에는 Primary Key(id)만 포함되어, student_id로 필터링이 안 됩니다.
-- 아래 설정을 켜면 삭제된 행의 모든 정보(student_id 포함)가 전송되어 필터링이 정상 작동합니다.

ALTER TABLE monthly_return_applications REPLICA IDENTITY FULL;
