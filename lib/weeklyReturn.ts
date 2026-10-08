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

    const getFormatDateStr = (d: Date) => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const d = new Date(date);
    const day = d.getDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat

    let fri = new Date(d);
    if (day === 0) fri.setDate(d.getDate() - 2);
    else if (day === 1) fri.setDate(d.getDate() - 3);
    else if (day === 2) fri.setDate(d.getDate() - 4);
    else if (day === 3) fri.setDate(d.getDate() + 2);
    else if (day === 4) fri.setDate(d.getDate() + 1);
    else if (day === 5) fri.setDate(d.getDate());
    else if (day === 6) fri.setDate(d.getDate() - 1);

    const friStr = getFormatDateStr(fri);
    const isFriHoliday = holidays.has(friStr);

    const start = new Date(fri);
    if (isFriHoliday) {
        start.setDate(fri.getDate() - 1); // 목요일
    }
    start.setHours(15, 30, 0, 0); // 15:30부터 시작

    const mon = new Date(fri);
    mon.setDate(fri.getDate() + 3);
    const monStr = getFormatDateStr(mon);
    const isMonHoliday = holidays.has(monStr);

    const end = new Date(fri);
    if (isMonHoliday) {
        end.setDate(fri.getDate() + 3);
    } else {
        end.setDate(fri.getDate() + 2);
    }
    end.setHours(18, 50, 0, 0);

    return date >= start && date <= end;
};
