-- ====================================================================
-- 2101 강동헌 학생 ↔ 이상찬 관리자님 1:1 실시간 채팅 테이블 및 Realtime 설정
-- ====================================================================

-- 1. 채팅 메시지 테이블 생성
CREATE TABLE IF NOT EXISTS public.dongheon_chats (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sender_role VARCHAR(20) NOT NULL, -- 'student' 또는 'teacher'
    sender_name VARCHAR(50) NOT NULL, -- '강동헌' 또는 '이상찬'
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 인덱스 생성 (조회 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_dongheon_chats_created_at ON public.dongheon_chats (created_at ASC);

-- 3. Row Level Security (RLS) 설정: 필요 시 완전 접근 허용
ALTER TABLE public.dongheon_chats ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'dongheon_chats' AND policyname = 'Allow all access to dongheon_chats'
    ) THEN
        CREATE POLICY "Allow all access to dongheon_chats" 
        ON public.dongheon_chats 
        FOR ALL 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;

-- 4. Supabase Realtime 활성화 (실시간 말풍선 수신용)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'dongheon_chats'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.dongheon_chats;
    END IF;
END $$;
