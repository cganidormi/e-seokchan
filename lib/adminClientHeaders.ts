/**
 * 관리자 전용 API 호출 시 교사 신원 검증 헤더(x-teacher-id)를 자동으로 생성합니다.
 */
export function getAdminHeaders(): HeadersInit {
    let teacherId = '';
    if (typeof window !== 'undefined') {
        teacherId = localStorage.getItem('dormichan_login_id') || sessionStorage.getItem('dormichan_login_id') || '';
    }

    return {
        'Content-Type': 'application/json',
        'x-teacher-id': encodeURIComponent(teacherId.trim())
    };
}
