import { createClient } from '@supabase/supabase-js'

// .env.local에서 환경 변수 읽기
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// supabase 객체 생성
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
