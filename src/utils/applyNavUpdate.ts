import type { Fund } from '../types';
import type { FundNavQuote } from '../types';
import {
  backfillFundFromNavMapDetailed,
} from './backfillNav';
import { fetchFundNav, fetchNavMapForFund } from './fundApi';
import { normalizeDateToISO } from './calculations';

export interface SyncResult {
  code: string;
  name: string;
  success: boolean;
  message: string;
  quote?: FundNavQuote;
}

function formatBackfillMessage(
  navDays: number,
  refreshed: number,
  inserted: number,
): string {
  const parts: string[] = [`已匹配 ${navDays} 日官方净值`];
  if (refreshed > 0) parts.push(`修正 ${refreshed} 条收盘净值`);
  if (inserted > 0) parts.push(`补全 ${inserted} 个无交易交易日`);
  return parts.join('，');
}

function countMatchedTransactionDates(fund: Fund, navMap: Map<string, unknown>): number {
  const dates = new Set(
    fund.transactions
      .filter((t) => t.date)
      .map((t) => normalizeDateToISO(t.date)),
  );
  let matched = 0;
  for (const date of dates) {
    if (navMap.has(date)) matched += 1;
  }
  return matched;
}

/** 拉取历史净值补全所有交易记录，并同步最新净值（全程重建收益） */
export async function syncFundComplete(fund: Fund): Promise<{
  fund: Fund;
  result: SyncResult;
}> {
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

  if (navMap.size === 0 && !quote) {
    throw new Error(`${fund.code} 无法获取净值数据，请检查网络后重试`);
  }

  const txDateCount = new Set(
    fund.transactions.filter((t) => t.date).map((t) => normalizeDateToISO(t.date)),
  ).size;
  const matchedTxDates = countMatchedTransactionDates(fund, navMap);

  if (txDateCount > 0 && matchedTxDates === 0) {
    throw new Error(
      `${fund.code} 官方净值日期与交易记录对不上（记录 ${txDateCount} 天，匹配 0 天），请检查交易日期`,
    );
  }

  let working = fund;
  let backfillMsg = '';
  let refreshedRows = 0;
  let insertedNavDays = 0;

  if (navMap.size > 0) {
    const backfill = backfillFundFromNavMapDetailed(fund, navMap);
    working = backfill.fund;
    refreshedRows = backfill.refreshedRows;
    insertedNavDays = backfill.insertedNavDays;
    backfillMsg = formatBackfillMessage(
      navMap.size,
      refreshedRows,
      insertedNavDays,
    );
  }

  if (quote) {
    working = {
      ...working,
      name: quote.name || working.name,
      sector: quote.sector || working.sector,
    };
  }

  const quoteIso = quote ? normalizeDateToISO(quote.navDate) : null;
  const latestMsg = quote
    ? quoteIso && refreshedRows === 0 && insertedNavDays === 0
      ? `已是最新（${quoteIso} 净值 ${quote.unitNav.toFixed(4)}）`
      : quoteIso
        ? `最新 ${quoteIso} 净值 ${quote.unitNav.toFixed(4)}`
        : ''
    : '';

  if (txDateCount > 0 && matchedTxDates < txDateCount) {
    const warn = `仅 ${matchedTxDates}/${txDateCount} 个交易日匹配到官方净值`;
    backfillMsg = backfillMsg ? `${backfillMsg}；${warn}` : warn;
  }

  return {
    fund: working,
    result: {
      code: fund.code,
      name: quote?.name || fund.name,
      success: true,
      message: [backfillMsg, latestMsg].filter(Boolean).join('；') || '净值已同步',
      quote: quote ?? undefined,
    },
  };
}

/** 将天天基金净值写入持仓记录（仅匹配同日期记录） */
export function applyNavQuote(fund: Fund, quote: FundNavQuote): Fund {
  const quoteIso = normalizeDateToISO(quote.navDate);
  const navMap = new Map([
    [
      quoteIso,
      {
        date: quoteIso,
        unitNav: quote.unitNav,
        accumulatedNav: quote.unitNav,
        dailyChange: quote.dailyChange,
      },
    ],
  ]);
  const { fund: updated } = backfillFundFromNavMapDetailed(fund, navMap);
  return {
    ...updated,
    name: quote.name || fund.name,
    sector: quote.sector || fund.sector,
  };
}

export function syncFundNav(
  fund: Fund,
  quote: FundNavQuote,
): { fund: Fund; result: SyncResult } {
  const quoteIso = normalizeDateToISO(quote.navDate);
  const before = fund.transactions.find(
    (t) => t.date && normalizeDateToISO(t.date) === quoteIso,
  );
  const updated = applyNavQuote(fund, { ...quote, navDate: quoteIso });
  const after = updated.transactions.find(
    (t) => t.date && normalizeDateToISO(t.date) === quoteIso,
  );

  const unchanged =
    before?.unitNav === after?.unitNav &&
    before?.dailyProfit === after?.dailyProfit;

  return {
    fund: updated,
    result: {
      code: fund.code,
      name: quote.name || fund.name,
      success: true,
      message: unchanged
        ? `已是最新（${quoteIso} 净值 ${quote.unitNav.toFixed(4)}）`
        : `已更新 ${quoteIso} 净值 ${quote.unitNav.toFixed(4)}`,
      quote: { ...quote, navDate: quoteIso },
    },
  };
}
