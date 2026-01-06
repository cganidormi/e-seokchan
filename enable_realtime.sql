-- [중요] 실시간 업데이트(Realtime) 기능을 켜는 스크립트입니다.
-- 이 스크립트를 실행해야 학생 신청 및 교사 승인/반려가 새로고침 없이 즉시 반영됩니다.

BEGIN;

-- 1. leave_requests 테이블을 실시간 감지 대상에 추가
ALTER PUBLICATION supabase_realtime ADD TABLE leave_requests;

-- 2. leave_request_students 테이블도 추가 (학생 추가/삭제 실시간 반영을 위해 권장)
ALTER PUBLICATION supabase_realtime ADD TABLE leave_request_students;

COMMIT;

-- 확인 방법: 실행 후 "Success" 메시지가 뜨면 적용된 것입니다.
-- 만약 "relation ... already in publication" 같은 에러가 나오면 이미 적용된 것이니 무시하셔도 됩니다.
