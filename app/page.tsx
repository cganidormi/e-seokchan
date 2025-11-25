'use client'
import { useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function Home() {
  useEffect(() => {
    async function fetchData() {
      // 모든 학생 불러오기
      const { data: students, error: studentError } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'student')
      console.log('학생 데이터:', students, studentError)

      // 출결 신청 가져오기
      const { data: requests, error: requestError } = await supabase
        .from('requests')
        .select('*')
      console.log('출결 신청 데이터:', requests, requestError)
    }

    fetchData()
  }, [])

  return <h1>Supabase 연결 테스트</h1>
}
