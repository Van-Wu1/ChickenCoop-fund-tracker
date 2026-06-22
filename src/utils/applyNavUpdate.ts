import type { Fund } from '../types';
import type { FundNavQuote } from '../types';
import {
  backfillFundFromNavMap,
} from './backfillNav';
import { fetchFundNav, fetchNavMapForFund } from './fundApi';
import { normalizeDateToISO } from './calculations';
import {
  addRecordToFund,
  computeTransaction,
} from './calculations';

function getPreviousTransaction(
  fund: Fund,
  current: { id: string },
) {
  const idx = fund.transactions.findIndex((t) => t.id === current.id);
  if (idx <= 0) return null;
  return fund.transactions[idx - 1];
}

function findTransactionOnDate(fund: Fund, navDate: string) {
  const iso = normalizeDateToISO(navDate);
  return fund.transactions.find(
    (t) => t.date && normalizeDateToISO(t.date) === iso,
  );
}

function updateTransactionUnitNav(
  fund: Fund,
  target: { id: string; date: string; amount: number; confirmedNav: number; fee: number; confirmedShares: number },
  quote: FundNavQuote,
): Fund {
  const prev = getPreviousTransaction(fund, target);
  const isNavOnly = target.amount === 0 && target.confirmedShares === 0;
  const tx = computeTransaction(
    {
      date: target.date,
      amount: target.amount,
      confirmedNav: target.confirmedNav,
      fee: target.fee,
      unitNav: quote.unitNav,
      isNavOnly,
    },
    prev,
  );
  if (quote.dailyChange !== null) {
    tx.dailyChange = quote.dailyChange;
  }
  return {
    ...fund,
    transactions: fund.transactions.map((t) =>
      t.id === target.id ? { ...tx, id: target.id } : t,
    ),
  };
}

/** 将天天基金净值写入持仓记录（仅匹配同日期记录） */
export function applyNavQuote(fund: Fund, quote: FundNavQuote): Fund {
  const updatedFund: Fund = {
    ...fund,
    name: quote.name || fund.name,
    sector: quote.sector || fund.sector,
  };

  const onDate = findTransactionOnDate(updatedFund, quote.navDate);
  if (
    onDate &&
    onDate.unitNav !== null &&
    Math.abs(onDate.unitNav - quote.unitNav) < 0.0001
  ) {
    return updatedFund;
  }

  if (onDate) {
    return updateTransactionUnitNav(updatedFund, onDate, quote);
  }

  return addRecordToFund(updatedFund, {
    date: quote.navDate,
    amount: 0,
    confirmedNav: 0,
    fee: 0,
    unitNav: quote.unitNav,
    isNavOnly: true,
  });
}

export interface SyncResult {
  code: string;
  name: string;
  success: boolean;
  message: string;
  quote?: FundNavQuote;
}

export function syncFundNav(
  fund: Fund,
  quote: FundNavQuote,
): { fund: Fund; result: SyncResult } {
  const before = findTransactionOnDate(fund, quote.navDate);
  const updated = applyNavQuote(fund, quote);
  const after = findTransactionOnDate(updated, quote.navDate);

  const unchanged =
    before?.unitNav === after?.unitNav &&
    (before?.unitNav !== null || before === after);

  return {
    fund: updated,
    result: {
      code: fund.code,
      name: quote.name || fund.name,
      success: true,
      message: unchanged
        ? `已是最新（${quote.navDate} 净值 ${quote.unitNav.toFixed(4)}）`
        : `已更新 ${quote.navDate} 净值 ${quote.unitNav.toFixed(4)}`,
      quote,
    },
  };
}

/** 拉取历史净值补全所有交易记录，并同步最新净值 */
export async function syncFundComplete(fund: Fund): Promise<{
  fund: Fund;
  result: SyncResult;
}> {
  let backfillMsg = '';
  const navMap = await fetchNavMapForFund(fund);

  let quote: FundNavQuote | null = null;
  try {
    quote = await fetchFundNav(fund.code);
    const quoteIso = normalizeDateToISO(quote.navDate);
    navMap.set(quoteIso, {
      date: quoteIso,
      unitNav: quote.unitNav,
      accumulatedNav: quote.unitNav,
      dailyChange: quote.dailyChange,
    });
  } catch {
    // 历史净值仍可用于按日期补全
  }

  let working = fund;
  if (navMap.size > 0) {
    working = backfillFundFromNavMap(fund, navMap);
    backfillMsg = `已按日期匹配 ${navMap.size} 日净值`;
  }

  if (quote) {
    const quoteIso = normalizeDateToISO(quote.navDate);
    const hasRowOnQuoteDate = working.transactions.some(
      (t) => t.date && normalizeDateToISO(t.date) === quoteIso,
    );
    if (!hasRowOnQuoteDate) {
      const { fund: synced, result } = syncFundNav(working, quote);
      return {
        fund: synced,
        result: {
          ...result,
          message: backfillMsg
            ? `${backfillMsg}；${result.message}`
            : result.message,
        },
      };
    }

    return {
      fund: working,
      result: {
        code: fund.code,
        name: quote.name || fund.name,
        success: true,
        message: backfillMsg
          ? `${backfillMsg}；最新 ${quote.navDate} 净值 ${quote.unitNav.toFixed(4)}`
          : `已是最新（${quote.navDate} 净值 ${quote.unitNav.toFixed(4)}）`,
        quote,
      },
    };
  }

  if (backfillMsg) {
    return {
      fund: working,
      result: {
        code: fund.code,
        name: fund.name,
        success: true,
        message: backfillMsg,
      },
    };
  }

  throw new Error(`${fund.code} 无法获取净值数据`);
}
