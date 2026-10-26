import * as XLSX from "xlsx";

export interface RoomSupervisionWeekday {
  afterSchool: string; // 16:30 ~ 18:20
  night1: string;      // 19:30 ~ 21:20
  night2: string;      // 21:20 ~ 23:30
}

export interface Room1SupervisionWeekend {
  morning: string;    // 09:00 ~ 13:15
  afternoon: string;  // 13:10 ~ 17:25
  night: string;      // 17:20 ~ 21:20
  nightCare: string;  // 21:20 ~ 22:20
}

export interface RoomCareSupervisionWeekend {
  dayCare: string;    // 08:50 ~ 20:50
  nightCare: string;  // 20:50 ~ 08:50
}

export interface DaySupervision {
  day: number;
  dow: string;
  isWeekend: boolean;
  weekday: {
    room1: RoomSupervisionWeekday;
    room2: RoomSupervisionWeekday;
    room3: RoomSupervisionWeekday;
  };
  weekend: {
    room1: Room1SupervisionWeekend;
    room2: RoomCareSupervisionWeekend;
    room3: RoomCareSupervisionWeekend;
  };
  returnGuide: string;
  note: string;
}

export interface MonthSupervision {
  month: number;
  days: DaySupervision[];
}

export interface SupervisionScheduleData {
  year: number;
  uploadedAt: string;
  fileName?: string;
  months: Record<number, MonthSupervision>;
}

export function parseSupervisionWorkbook(wb: XLSX.WorkBook, fileName?: string): SupervisionScheduleData {
  const result: SupervisionScheduleData = {
    year: 2026,
    uploadedAt: new Date().toISOString(),
    fileName,
    months: {},
  };

  const monthSheetNames = wb.SheetNames.filter((name) => /^\d{1,2}월$/.test(name.trim()));

  for (const sheetName of monthSheetNames) {
    const monthNum = parseInt(sheetName.replace("월", "").trim(), 10);
    const s = wb.Sheets[sheetName];
    if (!s) continue;

    // Check row 2 (e.g. 2026년 3월 근무표)
    const titleCell = s["A2"] ? (s["A2"].w || s["A2"].v || "") : "";
    const yearMatch = titleCell.toString().match(/(\d{4})년/);
    if (yearMatch) {
      result.year = parseInt(yearMatch[1], 10);
    }

    const days: DaySupervision[] = [];

    // Rows 8 to 42
    for (let r = 8; r <= 42; r++) {
      const dayCell = s[XLSX.utils.encode_cell({ r: r - 1, c: 0 })];
      const dowCell = s[XLSX.utils.encode_cell({ r: r - 1, c: 1 })];
      if (!dayCell) continue;

      const rawDay = dayCell.w || dayCell.v;
      const dayNum = parseInt(String(rawDay), 10);
      if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) continue;

      const dow = dowCell ? String(dowCell.w || dowCell.v || "").trim() : "";
      const isWeekend = ["토", "일"].includes(dow);

      const getVal = (col: number) => {
        const c = s[XLSX.utils.encode_cell({ r: r - 1, c: col })];
        if (!c) return "";
        let val = String(c.w || c.v || "").trim();
        return val === "-" ? "" : val;
      };

      const noteVal = getVal(20);

      const dayData: DaySupervision = {
        day: dayNum,
        dow,
        isWeekend,
        weekday: {
          room1: { afterSchool: getVal(2), night1: getVal(3), night2: getVal(4) },
          room2: { afterSchool: getVal(5), night1: getVal(6), night2: getVal(7) },
          room3: { afterSchool: getVal(8), night1: getVal(9), night2: getVal(10) },
        },
        weekend: {
          room1: { morning: getVal(11), afternoon: getVal(12), night: getVal(13), nightCare: getVal(14) },
          room2: { dayCare: getVal(15), nightCare: getVal(16) },
          room3: { dayCare: getVal(17), nightCare: getVal(18) },
        },
        returnGuide: getVal(19),
        note: noteVal,
      };

      days.push(dayData);
    }

    result.months[monthNum] = {
      month: monthNum,
      days,
    };
  }

  return result;
}
