/**
 * 매주귀가 시간대 판단 유틸리티
 *
 * 규칙:
 * 1. 기준 주 금요일을 구한다.
 * 2. 금요일이 공휴일(special_holidays)인 경우:
 *    - 목요일 15:30부터 귀가 시간대로 판정
 * 3. 금요일이 일반 평일인 경우:
 *    - 금요일 15:30부터 귀가 시간대로 판정
 * 4. 토요일: 종일 귀가 시간대
 * 5. 일요일: 18:50까지 귀가 시간대
 *    - 단, 월요일이 공휴일(대체공휴일 등)인 경우 월요일 18:50까지 연장
 */
export const isWeeklyHomeTime = (date: Date, holidaySet: Set<string> | string[] = new Set()): boolean => {
    const holidays = holidaySet instanceof Set ? holidaySet : new Set(holidaySet);

    // KST Offset (UTC+9)
    const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const kstDate = new Date(date.getTime() + KST_OFFSET_MS);

    const year = kstDate.getUTCFullYear();
    const month = kstDate.getUTCMonth();
    const dayOfMonth = kstDate.getUTCDate();
    const dayOfWeek = kstDate.getUTCDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat

    let diffDaysToFri = 0;
    if (dayOfWeek === 0) diffDaysToFri = -2;
    else if (dayOfWeek === 1) diffDaysToFri = -3;
    else if (dayOfWeek === 2) diffDaysToFri = -4;
    else if (dayOfWeek === 3) diffDaysToFri = 2;
    else if (dayOfWeek === 4) diffDaysToFri = 1;
    else if (dayOfWeek === 5) diffDaysToFri = 0;
    else if (dayOfWeek === 6) diffDaysToFri = -1;

    const friDate = new Date(Date.UTC(year, month, dayOfMonth + diffDaysToFri));
    const friYear = friDate.getUTCFullYear();
    const friMonth = String(friDate.getUTCMonth() + 1).padStart(2, '0');
    const friDay = String(friDate.getUTCDate()).padStart(2, '0');
    const friStr = `${friYear}-${friMonth}-${friDay}`;

    const isFriHoliday = holidays.has(friStr);

    // 시작 시각: 목요일 또는 금요일 KST 15:30 (UTC 기준 06:30)
    const startDaysOffset = isFriHoliday ? -1 : 0;
    const startDate = new Date(Date.UTC(friYear, friDate.getUTCMonth(), friDate.getUTCDate() + startDaysOffset, 15 - 9, 30, 0, 0));

    // 월요일 공휴일 여부 체크
    const monDate = new Date(Date.UTC(friYear, friDate.getUTCMonth(), friDate.getUTCDate() + 3));
    const monYear = monDate.getUTCFullYear();
    const monMonth = String(monDate.getUTCMonth() + 1).padStart(2, '0');
    const monDay = String(monDate.getUTCDate()).padStart(2, '0');
    const monStr = `${monYear}-${monMonth}-${monDay}`;
    const isMonHoliday = holidays.has(monStr);

    // 종료 시각: 일요일 또는 월요일 KST 18:50 (UTC 기준 09:50)
    const endDaysOffset = isMonHoliday ? 3 : 2;
    const endDate = new Date(Date.UTC(friYear, friDate.getUTCMonth(), friDate.getUTCDate() + endDaysOffset, 18 - 9, 50, 0, 0));

    return date.getTime() >= startDate.getTime() && date.getTime() <= endDate.getTime();
};
