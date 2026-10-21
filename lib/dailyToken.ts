/**
 * 오늘의 홍지관 일일 열람 링크용 보안 토큰 생성 및 검증 헬퍼
 * - 당일(KST 기준)에만 유효하며, 날짜가 지나면 자동으로 만료됩니다.
 */

// KST (한국 표준시 UTC+9) 기준 YYYY-MM-DD 문자열 반환
export const getKSTDateString = (date: Date = new Date()): string => {
    const kstOffset = 9 * 60; // 9 hours in minutes
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const kstDate = new Date(utc + (kstOffset * 60000));
    const year = kstDate.getFullYear();
    const month = String(kstDate.getMonth() + 1).padStart(2, '0');
    const day = String(kstDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// 특정 날짜에 대한 고유 토큰 생성 (결정론적 해시)
export const generateDailyToken = (dateStr: string): string => {
    const salt = process.env.NEXT_PUBLIC_DAILY_LINK_SALT || 'hongji_daily_secure_salt_2026';
    const text = `${dateStr}_${salt}_dormichan`;

    let hash1 = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash1 ^= text.charCodeAt(i);
        hash1 += (hash1 << 1) + (hash1 << 4) + (hash1 << 7) + (hash1 << 8) + (hash1 << 24);
    }
    const part1 = (hash1 >>> 0).toString(16).padStart(8, '0');

    let hash2 = 0x9e3779b9;
    for (let i = text.length - 1; i >= 0; i--) {
        hash2 ^= text.charCodeAt(i);
        hash2 = Math.imul(hash2, 0x5bd1e995);
        hash2 ^= hash2 >>> 15;
    }
    const part2 = (hash2 >>> 0).toString(16).padStart(8, '0');

    return `${part1}${part2}`;
};

// URL의 date와 token이 유효한지 검증
export const verifyDailyToken = (
    dateStr?: string | null,
    token?: string | null
): { isValid: boolean; reason?: 'expired' | 'invalid' | 'missing'; targetDate?: string; todayDate: string } => {
    const todayKST = getKSTDateString();

    if (!dateStr || !token) {
        return { isValid: false, reason: 'missing', todayDate: todayKST };
    }

    // 1. 날짜가 당일(한국시간)과 일치하는지 검증
    if (dateStr !== todayKST) {
        return { isValid: false, reason: 'expired', targetDate: dateStr, todayDate: todayKST };
    }

    // 2. 토큰이 해당 날짜의 서명과 일치하는지 검증
    const expectedToken = generateDailyToken(dateStr);
    if (token !== expectedToken) {
        return { isValid: false, reason: 'invalid', targetDate: dateStr, todayDate: todayKST };
    }

    return { isValid: true, targetDate: dateStr, todayDate: todayKST };
};
