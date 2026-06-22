import type {
  BatchDcaInput,
  Fund,
  NewRecordInput,
  PortfolioStats,
  Transaction,
} from '../types';

export function parseDateStr(date: string): Date {
  return new Date(`${normalizeDateToISO(date)}T12:00:00`);
}

/** 将 Excel 遗留的 616、2026-06-18 等格式统一为 YYYY-MM-DD */
export function normalizeDateToISO(date: string): string {
  if (!date) return date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;

  const year = new Date().getFullYear();
  const digits = date.replace(/\D/g, '');

  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }

  const padded = digits.padStart(4, '0');
  const month = padded.slice(0, 2);
  const day = padded.slice(2, 4);
  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(date: string): string {
  if (!date) return '—';
  return normalizeDateToISO(date);
}

export function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function compareDate(a: string, b: string): number {
  return parseDateStr(a).getTime() - parseDateStr(b).getTime();
}

import { isTradingDay } from './tradingCalendar';

export function enumerateDates(
  startDate: string,
  endDate: string,
  skipNonTradingDays: boolean,
): string[] {
  const dates: string[] = [];
  const cur = parseDateStr(startDate);
  const end = parseDateStr(endDate);
  while (cur <= end) {
    const iso = formatDateISO(cur);
    if (!skipNonTradingDays || isTradingDay(iso)) {
      dates.push(iso);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export function transactionToInput(
  t: Transaction,
): NewRecordInput & { id?: string } {
  const isNavOnly =
    t.amount === 0 && t.confirmedShares === 0 && t.confirmedNav === 0;
  return {
    id: t.id,
    date: t.date,
    amount: t.amount,
    confirmedNav: t.confirmedNav,
    fee: t.fee,
    unitNav: t.unitNav,
    isNavOnly,
  };
}

type RecordInput = NewRecordInput & { id?: string };

export function rebuildTransactions(inputs: RecordInput[]): Transaction[] {
  const sorted = [...inputs].sort((a, b) => compareDate(a.date, b.date));
  const result: Transaction[] = [];
  for (const input of sorted) {
    const prev = result.length > 0 ? result[result.length - 1] : null;
    const tx = computeTransaction(input, prev);
    if (input.id) tx.id = input.id;
    result.push(tx);
  }
  return result;
}

export function setFundTransactions(
  fund: Fund,
  inputs: NewRecordInput[],
): Fund {
  return { ...fund, transactions: rebuildTransactions(inputs) };
}

export function addRecordToFund(fund: Fund, input: NewRecordInput): Fund {
  const normalized = { ...input, date: normalizeDateToISO(input.date) };
  const inputs = fund.transactions
    .filter((t) => t.date)
    .map(transactionToInput);
  inputs.push(normalized);
  return setFundTransactions(fund, inputs);
}

export function updateFundTransaction(
  fund: Fund,
  txId: string,
  input: NewRecordInput,
): Fund {
  const normalized = { ...input, date: normalizeDateToISO(input.date) };
  const inputs = fund.transactions
    .filter((t) => t.date)
    .map((t) => (t.id === txId ? normalized : transactionToInput(t)));
  return setFundTransactions(fund, inputs);
}

export function deleteFundTransaction(fund: Fund, txId: string): Fund {
  const inputs = fund.transactions
    .filter((t) => t.date && t.id !== txId)
    .map(transactionToInput);
  return setFundTransactions(fund, inputs);
}

export function getPurchaseDates(fund: Fund): Set<string> {
  return new Set(
    fund.transactions.filter((t) => t.date && t.amount > 0).map((t) => t.date),
  );
}

export function buildBatchDcaInputs(
  batch: BatchDcaInput,
  navByDate: Map<string, { unitNav: number }>,
  existingPurchaseDates: Set<string>,
): NewRecordInput[] {
  return enumerateDates(batch.startDate, batch.endDate, batch.skipNonTradingDays)
    .filter((date) => !existingPurchaseDates.has(date))
    .map((date) => {
      const nav = navByDate.get(date);
      const navVal = nav?.unitNav ?? null;
      return {
        date,
        amount: batch.dailyAmount,
        confirmedNav: navVal ?? 0,
        fee: batch.fee,
        unitNav: null,
        isNavOnly: false,
      };
    });
}

export function appendBatchDcaToFund(
  fund: Fund,
  newInputs: NewRecordInput[],
): Fund {
  const inputs = fund.transactions
    .filter((t) => t.date)
    .map(transactionToInput);
  return setFundTransactions(fund, [...inputs, ...newInputs]);
}

export function computeTransaction(
  input: NewRecordInput,
  prev: Transaction | null,
): Transaction {
  const prevShares = prev?.holdingShares ?? 0;
  const prevMarketValue = prev?.marketValue ?? 0;

  let confirmedShares = 0;
  let holdingShares = prevShares;
  let holdingAmount = (prev?.holdingAmount ?? 0) + input.amount;

  if (!input.isNavOnly && input.amount > 0 && input.confirmedNav > 0) {
    confirmedShares = input.amount / input.confirmedNav;
    holdingShares = prevShares + confirmedShares;
  } else if (input.isNavOnly) {
    holdingShares = prevShares;
    holdingAmount = prev?.holdingAmount ?? 0;
  }

  const unitNav = input.unitNav;
  const marketValue =
    unitNav !== null && holdingShares > 0 ? holdingShares * unitNav : null;

  let dailyProfit: number | null = null;
  let cumulativeProfit: number | null = null;
  if (marketValue !== null) {
    cumulativeProfit = marketValue - holdingAmount;
    if (input.isNavOnly || input.amount === 0) {
      dailyProfit = marketValue - prevMarketValue;
    } else {
      dailyProfit = marketValue - prevMarketValue - input.amount;
    }
  }

  let dailyChange: number | null = null;
  if (unitNav !== null && prev?.unitNav) {
    dailyChange = (unitNav - prev.unitNav) / prev.unitNav;
  }

  return {
    id: crypto.randomUUID(),
    date: input.date,
    confirmedShares,
    confirmedNav: input.confirmedNav,
    amount: input.amount,
    fee: input.fee,
    holdingShares,
    holdingAmount,
    unitNav,
    dailyChange,
    marketValue,
    dailyProfit,
    cumulativeProfit,
  };
}

export function getLatestTransaction(fund: Fund): Transaction | null {
  const valid = fund.transactions.filter((t) => t.date);
  if (valid.length === 0) return null;
  return [...valid].sort((a, b) => compareDate(a.date, b.date)).at(-1)!;
}

/** 最近一条已有收盘净值/市值数据的记录 */
export function getLatestPricedTransaction(fund: Fund): Transaction | null {
  const priced = fund.transactions.filter(
    (t) => t.date && t.marketValue !== null,
  );
  if (priced.length === 0) return null;
  return [...priced].sort((a, b) => compareDate(a.date, b.date)).at(-1)!;
}

export function getFundStats(fund: Fund) {
  const priced = getLatestPricedTransaction(fund);
  const latest = getLatestTransaction(fund);
  const basis = priced ?? latest;

  const cost = basis?.holdingAmount ?? 0;
  const marketValue = priced?.marketValue ?? cost;
  const profit =
    priced?.cumulativeProfit ?? (priced ? marketValue - cost : 0);
  const profitRate = cost > 0 ? profit / cost : 0;
  const dailyProfit = priced?.dailyProfit ?? 0;
  const dailyChange = priced?.dailyChange ?? null;
  const profitDate = priced?.date ?? null;
  const holdingShares = basis?.holdingShares ?? 0;

  return {
    cost,
    marketValue,
    profit,
    profitRate,
    dailyProfit,
    dailyChange,
    profitDate,
    holdingShares,
  };
}

export function getPortfolioStats(funds: Fund[]): PortfolioStats {
  let totalCost = 0;
  let totalMarketValue = 0;
  let totalDailyProfit = 0;

  for (const fund of funds) {
    const stats = getFundStats(fund);
    totalCost += stats.cost;
    totalMarketValue += stats.marketValue;
    totalDailyProfit += stats.dailyProfit;
  }

  return {
    totalCost,
    totalMarketValue,
    totalProfit: totalMarketValue - totalCost,
    totalDailyProfit,
  };
}

export function formatMoney(value: number, digits = 2): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPercent(value: number | null, digits = 2): string {
  if (value === null) return '—';
  const pct = value * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(digits)}%`;
}

export function profitColor(value: number): string {
  if (value > 0) return 'var(--profit-up)';
  if (value < 0) return 'var(--profit-down)';
  return 'var(--text-secondary)';
}
