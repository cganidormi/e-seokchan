'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // localStorage 또는 sessionStorage에서 로그인 정보 확인
    const loginId = localStorage.getItem('dormichan_login_id') || sessionStorage.getItem('dormichan_login_id')
    const role = localStorage.getItem('dormichan_role') || sessionStorage.getItem('dormichan_role')

    if (loginId && role) {
      // 로그인 상태가 있으면 역할에 맞는 페이지로 이동
      if (role === 'student') {
        router.push('/student')
      } else if (role === 'teacher') {
        router.push('/teacher')
      } else {
        router.push('/login')
      }
    } else {
      // 로그인 상태가 없으면 로그인 페이지로 이동
      router.push('/login')
    }
  }, [router])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '24px', marginBottom: '16px' }}>로딩 중...</div>
      </div>
    </div>
  )
}
