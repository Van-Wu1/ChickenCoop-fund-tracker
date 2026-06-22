import type { Fund, NavHistoryItem } from '../types';
import {
  compareDate,
  formatDateISO,
  normalizeDateToISO,
  parseDateStr,
  setFundTransactions,
  transactionToInput,
} from './calculations';

export function getExactNavForDate(
  navMap: Map<string, NavHistoryItem>,
  date: string,
): NavHistoryItem | null {
  const iso = normalizeDateToISO(date);
  return navMap.get(iso) ?? null;
}

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

export function backfillFundFromNavMap(
  fund: Fund,
  navMap: Map<string, NavHistoryItem>,
): Fund {
  if (navMap.size === 0) return fund;

  const inputs = fund.transactions
    .filter((t) => t.date)
    .map((input) => {
      const base = transactionToInput(input);
      const confirmNav = getNavForDate(navMap, base.date);
      const closingNav = getExactNavForDate(navMap, base.date);

      const next = { ...base };
      if (base.amount > 0 && base.confirmedNav <= 0 && confirmNav) {
        next.confirmedNav = confirmNav.unitNav;
      }
      // 收盘净值：仅在该日有官方净值时填入，不做向前查找
      next.unitNav = closingNav ? closingNav.unitNav : null;
      return next;
    });

  return setFundTransactions(fund, inputs);
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
