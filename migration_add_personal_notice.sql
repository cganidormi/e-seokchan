-- 1. students 테이블에 personal_notice 컬럼 추가
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS personal_notice TEXT;

-- 2. students 테이블 변경 사항 실시간 구독(Realtime)을 위해 혹시 안 켜져 있으면 켜기
-- (선택 사항: 이미 켜져 있을 가능성이 높지만, push_subscriptions 등에서 켜져 있다면 추가 확인용)
ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
