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
  if (t.kind === 'sell') {
    return {
      id: t.id,
      date: t.date,
      amount: t.amount,
      confirmedNav: t.confirmedNav,
      fee: t.fee,
      unitNav: t.unitNav,
      isNavOnly: false,
      recordKind: 'sell',
      sellShares: t.confirmedShares,
      redemptionAmount: t.amount,
    };
  }

  const isFailedPurchase =
    t.amount > 0 && t.confirmedNav <= 0 && t.confirmedShares <= 0;

  if (isFailedPurchase) {
    return {
      id: t.id,
      date: t.date,
      amount: 0,
      confirmedNav: 0,
      fee: 0,
      unitNav: t.unitNav,
      isNavOnly: true,
      recordKind: 'nav',
    };
  }

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
    recordKind: isNavOnly ? 'nav' : 'buy',
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
  const kind = input.recordKind ?? (input.isNavOnly ? 'nav' : 'buy');

  if (kind === 'sell') {
    const nav = input.unitNav ?? input.confirmedNav;
    const sharesToSell = input.sellShares ?? prevShares;
    const redemptionValue =
      input.redemptionAmount ?? (sharesToSell > 0 ? sharesToSell * nav : 0);
    const prevCost = prev?.holdingAmount ?? 0;
    const basisMarketValue =
      prevMarketValue > 0
        ? prevMarketValue
        : prevShares > 0 && prev?.unitNav
          ? prevShares * prev.unitNav
          : prevCost;

    return {
      id: crypto.randomUUID(),
      date: input.date,
      kind: 'sell',
      confirmedShares: sharesToSell,
      confirmedNav: nav,
      amount: redemptionValue,
      fee: input.fee,
      holdingShares: 0,
      holdingAmount: 0,
      unitNav: nav,
      dailyChange:
        nav && prev?.unitNav ? (nav - prev.unitNav) / prev.unitNav : null,
      marketValue: redemptionValue,
      dailyProfit: redemptionValue - basisMarketValue,
      cumulativeProfit: redemptionValue - prevCost,
    };
  }

  let confirmedShares = 0;
  let holdingShares = prevShares;
  let holdingAmount = prev?.holdingAmount ?? 0;

  const isSuccessfulPurchase =
    !input.isNavOnly &&
    input.recordKind !== 'sell' &&
    input.amount > 0 &&
    input.confirmedNav > 0;

  if (isSuccessfulPurchase) {
    confirmedShares = input.amount / input.confirmedNav;
    holdingShares = prevShares + confirmedShares;
    holdingAmount += input.amount + input.fee;
  } else if (input.isNavOnly) {
    holdingShares = prevShares;
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
    kind,
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

export function getFundStatus(fund: Fund): 'holding' | 'closed' {
  if (fund.status === 'closed') return 'closed';
  const latest = getLatestTransaction(fund);
  if (latest?.kind === 'sell') return 'closed';
  return 'holding';
}

export function isFundClosed(fund: Fund): boolean {
  return getFundStatus(fund) === 'closed';
}

function getClosedFundStats(fund: Fund) {
  const sellTx = [...fund.transactions]
    .filter((t) => t.date && t.kind === 'sell')
    .sort((a, b) => compareDate(a.date, b.date))
    .at(-1);

  const realizedProfit = sellTx?.cumulativeProfit ?? 0;
  const profitRate =
    sellTx && sellTx.amount > 0
      ? realizedProfit / (sellTx.amount - realizedProfit)
      : 0;

  return {
    cost: 0,
    marketValue: 0,
    profit: realizedProfit,
    profitRate: Number.isFinite(profitRate) ? profitRate : 0,
    dailyProfit: 0,
    dailyChange: null,
    profitDate: sellTx?.date ?? null,
    holdingShares: 0,
    closed: true as const,
  };
}

export function getFundStats(fund: Fund) {
  if (isFundClosed(fund)) {
    return getClosedFundStats(fund);
  }

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
    closed: false as const,
  };
}

export function getPortfolioStats(funds: Fund[]): PortfolioStats {
  let totalCost = 0;
  let totalMarketValue = 0;
  let totalDailyProfit = 0;
  let totalProfit = 0;

  for (const fund of funds) {
    const stats = getFundStats(fund);
    if (stats.closed) {
      totalProfit += stats.profit;
      continue;
    }
    totalCost += stats.cost;
    totalMarketValue += stats.marketValue;
    totalDailyProfit += stats.dailyProfit;
    totalProfit += stats.profit;
  }

  return {
    totalCost,
    totalMarketValue,
    totalProfit,
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
