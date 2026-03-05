-- ==============================================================================
-- [마이그레이션 스크립트 v2] 학부모 토큰(parent_token)을 6자리 영문+숫자 형식으로 일괄 변경
-- (push_subscriptions 외래키 제약조건 해결 버전)
-- ==============================================================================

-- 1단계: 임시 매핑 테이블 생성하여 기존 토큰과 새 6자리 토큰을 1:1로 매치 생성
CREATE TEMP TABLE temp_token_mapping AS
SELECT 
    parent_token AS old_token,
    chr(cast(floor(random() * 26) + 65 as integer)) || 
    chr(cast(floor(random() * 26) + 65 as integer)) || 
    lpad(cast(floor(random() * 10000) as text), 4, '0') AS new_token
FROM public.students
WHERE parent_token IS NOT NULL;

-- 2단계: 잠시 외래키(Foreign Key) 제약조건 제거 (업데이트 중 에러 방지)
-- 만약 아래 제약조건 이름이 다르다면, 에러 메시지에 나온 이름으로 바꿔주세요.
-- 에러 메시지: push_subscriptions_parent_token_fkey
ALTER TABLE public.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_parent_token_fkey;

-- 3단계: push_subscriptions 테이블의 토큰 먼저 변경
UPDATE public.push_subscriptions p
SET parent_token = m.new_token
FROM temp_token_mapping m
WHERE p.parent_token = m.old_token;

-- 4단계: students 테이블의 토큰 변경 (기존에 토큰이 있던 학생들)
UPDATE public.students s
SET parent_token = m.new_token
FROM temp_token_mapping m
WHERE s.parent_token = m.old_token;

-- 5단계: students 테이블 중 토큰이 아예 없던(NULL) 학생들에게도 새 토큰 부여
UPDATE public.students
SET parent_token = 
    chr(cast(floor(random() * 26) + 65 as integer)) || 
    chr(cast(floor(random() * 26) + 65 as integer)) || 
    lpad(cast(floor(random() * 10000) as text), 4, '0')
WHERE parent_token IS NULL;

-- 6단계: 외래키 제약조건 원상복구 (ON UPDATE CASCADE 추가로 향후 변경 시 자동 연동되게 함)
ALTER TABLE public.push_subscriptions
ADD CONSTRAINT push_subscriptions_parent_token_fkey
FOREIGN KEY (parent_token) REFERENCES public.students(parent_token)
ON DELETE CASCADE ON UPDATE CASCADE;

-- 완료 확인
-- SELECT count(*) FROM students; 
-- 등등 원하시는 조회 쿼리 활용
