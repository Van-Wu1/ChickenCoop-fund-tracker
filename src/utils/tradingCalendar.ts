import { compareDate, normalizeDateToISO, parseDateStr } from './calculations';

/** 上交所公布的休市区间（含周末） */
const HOLIDAY_RANGES: Array<[string, string]> = [
  // 2024
  ['2024-01-01', '2024-01-01'],
  ['2024-02-09', '2024-02-17'],
  ['2024-04-04', '2024-04-06'],
  ['2024-05-01', '2024-05-05'],
  ['2024-06-08', '2024-06-10'],
  ['2024-09-15', '2024-09-17'],
  ['2024-10-01', '2024-10-07'],
  // 2025
  ['2025-01-01', '2025-01-01'],
  ['2025-01-28', '2025-02-04'],
  ['2025-04-04', '2025-04-06'],
  ['2025-05-01', '2025-05-05'],
  ['2025-05-31', '2025-06-02'],
  ['2025-10-01', '2025-10-08'],
  // 2026（上交所 2025-12-22 公告）
  ['2026-01-01', '2026-01-03'],
  ['2026-02-15', '2026-02-23'],
  ['2026-04-04', '2026-04-06'],
  ['2026-05-01', '2026-05-05'],
  ['2026-06-19', '2026-06-21'],
  ['2026-09-25', '2026-09-27'],
  ['2026-10-01', '2026-10-07'],
];

/** 周末调休开市日 */
const EXTRA_TRADING_DAYS = new Set([
  '2025-01-26',
  '2025-02-08',
  '2025-04-27',
  '2025-09-28',
  '2025-10-11',
]);

function isInHolidayRange(date: string): boolean {
  return HOLIDAY_RANGES.some(
    ([start, end]) => compareDate(date, start) >= 0 && compareDate(date, end) <= 0,
  );
}

/** 是否为 A 股交易日（周末 + 法定休市，含调休开市） */
export function isTradingDay(date: string): boolean {
  const iso = normalizeDateToISO(date);
  if (EXTRA_TRADING_DAYS.has(iso)) return true;
  if (isInHolidayRange(iso)) return false;
  const dow = parseDateStr(iso).getDay();
  return dow !== 0 && dow !== 6;
}
