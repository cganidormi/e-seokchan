-- 시스템 전역 설정을 저장하는 테이블 (예: 학부모 페이지 전광판 내용 등)
CREATE TABLE IF NOT EXISTS public.system_settings (
    setting_key text PRIMARY KEY,
    setting_value text NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);

-- 기본 학부모 전광판 내용 삽입 (없으면 생성)
INSERT INTO public.system_settings (setting_key, setting_value)
VALUES (
    'parent_notice', 
    '학생들의 외출, 외박 신청을 받으시고 1차 승인 여부를 결정하시면 2차 담임선생님의 승인을 받고 출타를 할 수 있습니다.'
)
ON CONFLICT (setting_key) DO NOTHING;

-- RLS 활성화
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 읽기는 누구나 가능
CREATE POLICY "Allow public read on system_settings"
    ON public.system_settings
    FOR SELECT
    USING (true);

-- 쓰기는 Service Role (API) 만 허용 (웹 브라우저에서 직접 쓰기 불가)
-- (기본적으로 Service Role은 모든 RLS를 우회하므로 명시적인 ALLOW 정책 미작성해도 동작함)

-- Realtime 활성화 (선택 사항: 실시간 동기화를 위해)
alter publication supabase_realtime add table public.system_settings;
