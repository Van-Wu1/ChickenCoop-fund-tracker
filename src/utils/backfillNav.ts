import type { Fund, NavHistoryItem, NewRecordInput } from '../types';
import {
  compareDate,
  formatDateISO,
  normalizeDateToISO,
  parseDateStr,
  setFundTransactions,
  transactionToInput,
} from './calculations';

/** 统一 navMap 键为 YYYY-MM-DD，避免 API 与本地日期格式不一致 */
export function normalizeNavMap(
  navMap: Map<string, NavHistoryItem>,
): Map<string, NavHistoryItem> {
  const normalized = new Map<string, NavHistoryItem>();
  for (const [key, item] of navMap) {
    const iso = normalizeDateToISO(key);
    normalized.set(iso, { ...item, date: iso });
  }
  return normalized;
}

export function getExactNavForDate(
  navMap: Map<string, NavHistoryItem>,
  date: string,
): NavHistoryItem | null {
  const iso = normalizeDateToISO(date);
  return navMap.get(iso) ?? null;
}

/** 仅用于补全缺失的确认净值（如批量定投），向前最多查 10 个交易日 */
export function getNavForDate(
  navMap: Map<string, NavHistoryItem>,
  date: string,
): NavHistoryItem | null {
  const iso = normalizeDateToISO(date);
  if (navMap.has(iso)) return navMap.get(iso)!;

  const d = parseDateStr(iso);
  for (let i = 1; i <= 10; i++) {
    d.setDate(d.getDate() - 1);
    const key = formatDateISO(d);
    if (navMap.has(key)) return navMap.get(key)!;
  }
  return null;
}

export function fundNeedsNavBackfill(fund: Fund): boolean {
  return fund.transactions.some((t) => {
    if (!t.date) return false;
    if (t.amount > 0 && t.confirmedNav <= 0) return true;
    const isNavOnly =
      t.amount === 0 && t.confirmedShares === 0 && t.confirmedNav === 0;
    if (isNavOnly && t.unitNav === null) return true;
    return false;
  });
}

export interface NavBackfillResult {
  fund: Fund;
  /** 新插入的仅净值记录数（无交易的交易日） */
  insertedNavDays: number;
  /** 从官方数据刷新了收盘净值的记录数 */
  refreshedRows: number;
}

/**
 * 用官方历史净值补全基金：
 * 1. 每条已有记录的 unitNav 仅按「同日期精确匹配」写入，绝不填相邻日净值
 * 2. 在持仓区间内，为 navMap 中有净值但无记录的交易日插入「收盘更新」行
 */
export function backfillFundFromNavMap(
  fund: Fund,
  navMap: Map<string, NavHistoryItem>,
): Fund {
  return backfillFundFromNavMapDetailed(fund, navMap).fund;
}

export function backfillFundFromNavMapDetailed(
  fund: Fund,
  navMap: Map<string, NavHistoryItem>,
): NavBackfillResult {
  if (navMap.size === 0) {
    return { fund, insertedNavDays: 0, refreshedRows: 0 };
  }

  const map = normalizeNavMap(navMap);
  const range = getFundDateRange(fund);
  const existingDates = new Set(
    fund.transactions
      .filter((t) => t.date)
      .map((t) => normalizeDateToISO(t.date)),
  );

  const inputs: (NewRecordInput & { id?: string })[] = [];
  let refreshedRows = 0;

  for (const t of fund.transactions.filter((tx) => tx.date)) {
    const iso = normalizeDateToISO(t.date);
    const base = transactionToInput({ ...t, date: iso });
    const closingNav = getExactNavForDate(map, iso);

    const next: NewRecordInput & { id?: string } = {
      ...base,
      date: iso,
      unitNav: closingNav ? closingNav.unitNav : base.unitNav,
    };

    if (base.amount > 0 && base.confirmedNav <= 0) {
      const confirmNav =
        getExactNavForDate(map, iso) ?? getNavForDate(map, iso);
      if (confirmNav) next.confirmedNav = confirmNav.unitNav;
    }

    if (closingNav && t.unitNav !== closingNav.unitNav) {
      refreshedRows += 1;
    }

    if (t.id) next.id = t.id;
    inputs.push(next);
  }

  let insertedNavDays = 0;
  if (range) {
    const navDatesInRange = [...map.keys()]
      .filter(
        (d) =>
          compareDate(d, range.start) >= 0 && compareDate(d, range.end) <= 0,
      )
      .sort((a, b) => compareDate(a, b));

    for (const date of navDatesInRange) {
      if (existingDates.has(date)) continue;
      const item = map.get(date)!;
      inputs.push({
        date,
        amount: 0,
        confirmedNav: 0,
        fee: 0,
        unitNav: item.unitNav,
        isNavOnly: true,
        recordKind: 'nav',
      });
      insertedNavDays += 1;
    }
  }

  return {
    fund: setFundTransactions(fund, inputs),
    insertedNavDays,
    refreshedRows,
  };
}

export function getFundDateRange(fund: Fund): { start: string; end: string } | null {
  const dates = fund.transactions
    .filter((t) => t.date)
    .map((t) => normalizeDateToISO(t.date));
  if (dates.length === 0) return null;

  dates.sort((a, b) => compareDate(a, b));
  const today = formatDateISO(new Date());
  const end =
    compareDate(dates[dates.length - 1], today) > 0
      ? dates[dates.length - 1]
      : today;

  return { start: dates[0], end };
}
