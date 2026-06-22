import type { Fund } from '../types';
import { normalizeDateToISO } from './calculations';

/** 按日期汇总全部基金的当日收益 */
export function getPortfolioDailyProfits(funds: Fund[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const fund of funds) {
    for (const tx of fund.transactions) {
      if (!tx.date || tx.dailyProfit === null) continue;
      const date = normalizeDateToISO(tx.date);
      map.set(date, (map.get(date) ?? 0) + tx.dailyProfit);
    }
  }
  return map;
}

export interface CalendarCell {
  date: string | null;
  profit: number | null;
}

export interface YearCalendarGrid {
  rows: CalendarCell[][];
  weekCount: number;
  yearTotal: number;
  maxAbs: number;
  activeDays: number;
}

export function buildYearCalendarGrid(
  profitMap: Map<string, number>,
  year: number,
): YearCalendarGrid {
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);

  const gridStart = new Date(jan1);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const gridEnd = new Date(dec31);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  const rows: CalendarCell[][] = Array.from({ length: 7 }, () => []);
  let yearTotal = 0;
  let maxAbs = 0;
  let activeDays = 0;

  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    for (let dow = 0; dow < 7; dow++) {
      let date: string | null = null;
      let profit: number | null = null;

      if (cursor.getFullYear() === year) {
        date = formatDate(cursor);
        if (profitMap.has(date)) {
          profit = profitMap.get(date)!;
          yearTotal += profit;
          activeDays += 1;
          maxAbs = Math.max(maxAbs, Math.abs(profit));
        }
      }

      rows[dow].push({ date, profit });
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return {
    rows,
    weekCount: rows[0]?.length ?? 0,
    yearTotal,
    maxAbs,
    activeDays,
  };
}

export function getWeekColumnForDate(
  year: number,
  date: Date = new Date(),
): number {
  const jan1 = new Date(year, 0, 1);
  const gridStart = new Date(jan1);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  gridStart.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (target.getTime() - gridStart.getTime()) / 86400000,
  );
  return Math.max(0, Math.floor(diffDays / 7));
}

export function getMonthLabelPositions(
  year: number,
): Array<{ month: number; col: number }> {
  const jan1 = new Date(year, 0, 1);
  const gridStart = new Date(jan1);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const labels: Array<{ month: number; col: number }> = [];
  let lastCol = -1;

  for (let m = 0; m < 12; m++) {
    const first = new Date(year, m, 1);
    const diffDays = Math.round(
      (first.getTime() - gridStart.getTime()) / 86400000,
    );
    const col = Math.floor(diffDays / 7);
    if (col !== lastCol) {
      labels.push({ month: m + 1, col });
      lastCol = col;
    }
  }

  return labels;
}

export function getAvailableYears(funds: Fund[]): number[] {
  const years = new Set<number>();
  const current = new Date().getFullYear();
  years.add(current);

  for (const fund of funds) {
    for (const tx of fund.transactions) {
      if (!tx.date) continue;
      const d = normalizeDateToISO(tx.date);
      if (/^\d{4}/.test(d)) {
        years.add(Number(d.slice(0, 4)));
      }
    }
  }

  return [...years].sort((a, b) => b - a);
}

export function getProfitLevel(
  profit: number | null,
  maxAbs: number,
): number {
  if (profit === null || profit === 0 || maxAbs <= 0) return 0;
  const ratio = Math.abs(profit) / maxAbs;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function findBestMonth(
  profitMap: Map<string, number>,
  year: number,
): { month: number; total: number } | null {
  const totals = new Map<number, number>();

  for (const [date, profit] of profitMap) {
    if (!date.startsWith(String(year))) continue;
    const month = Number(date.slice(5, 7));
    totals.set(month, (totals.get(month) ?? 0) + profit);
  }

  if (totals.size === 0) return null;

  let bestMonth = 1;
  let bestTotal = -Infinity;
  for (const [month, total] of totals) {
    if (total > bestTotal) {
      bestTotal = total;
      bestMonth = month;
    }
  }

  return { month: bestMonth, total: bestTotal };
}
