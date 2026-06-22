import type { Fund, FundNavQuote, NavHistoryItem } from '../types';
import { compareDate, formatDateISO } from './calculations';
import { getFundDateRange } from './backfillNav';

export type { FundNavQuote };

interface JsonpPayload {
  fundcode: string;
  name: string;
  jzrq: string;
  dwjz: string;
  gsz: string;
  gszzl: string;
  gztime: string;
}

interface LsjzItem {
  FSRQ: string;
  DWJZ: string;
  JZZZL: string;
}

function parsePercent(value: string | undefined): number | null {
  if (!value || value === '' || value === '--') return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n / 100 : null;
}

function fetchJsonp(code: string): Promise<JsonpPayload> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(`${code} 请求超时`));
    }, 12000);

    const cleanup = () => {
      window.clearTimeout(timer);
      delete (window as unknown as Record<string, unknown>).jsonpgz;
      script.remove();
    };

    (window as unknown as Record<string, unknown>).jsonpgz = (data: JsonpPayload) => {
      cleanup();
      if (!data?.fundcode) {
        reject(new Error(`${code} 返回数据无效`));
        return;
      }
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error(`${code} 网络请求失败`));
    };

    script.src = `https://fundgz.1234567.com.cn/js/${code}.js?rt=${Date.now()}`;
    document.head.appendChild(script);
  });
}

async function fetchOfficialNav(code: string): Promise<LsjzItem | null> {
  const params = new URLSearchParams({
    fundCode: code,
    pageIndex: '1',
    pageSize: '1',
    startDate: '',
    endDate: '',
  });
  const res = await fetch(`/api/fund/f10/lsjz?${params}`);
  if (!res.ok) return null;

  const data = (await res.json()) as {
    Data?: { LSJZList?: LsjzItem[] };
  };
  return data.Data?.LSJZList?.[0] ?? null;
}

function fromJsonp(data: JsonpPayload): FundNavQuote {
  return {
    code: data.fundcode,
    name: data.name,
    navDate: data.jzrq,
    unitNav: parseFloat(data.dwjz),
    dailyChange: parsePercent(data.gszzl),
    estimateNav: parseFloat(data.gsz) || null,
    estimateChange: parsePercent(data.gszzl),
    estimateTime: data.gztime || null,
    source: 'estimate',
  };
}

function fromOfficial(
  code: string,
  item: LsjzItem,
  name: string,
): FundNavQuote {
  return {
    code,
    name,
    navDate: item.FSRQ,
    unitNav: parseFloat(item.DWJZ),
    dailyChange: parsePercent(item.JZZZL),
    estimateNav: null,
    estimateChange: null,
    estimateTime: null,
    source: 'official',
  };
}

/** 从天天基金拉取最新净值（优先官方收盘，失败则用 JSONP 估值接口） */
export async function fetchFundNav(code: string): Promise<FundNavQuote> {
  let jsonpData: JsonpPayload | null = null;

  try {
    jsonpData = await fetchJsonp(code);
  } catch {
    // JSONP 失败时仍尝试官方接口
  }

  try {
    const official = await fetchOfficialNav(code);
    if (official) {
      return fromOfficial(code, official, jsonpData?.name ?? '');
    }
  } catch {
    // 开发环境外或无代理时走 JSONP
  }

  if (jsonpData) {
    return fromJsonp(jsonpData);
  }

  throw new Error(`${code} 无法获取净值数据`);
}

export async function fetchAllFundNavs(
  codes: string[],
): Promise<Map<string, FundNavQuote | Error>> {
  const results = new Map<string, FundNavQuote | Error>();

  for (const code of codes) {
    try {
      results.set(code, await fetchFundNav(code));
    } catch (err) {
      results.set(
        code,
        err instanceof Error ? err : new Error(String(err)),
      );
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  return results;
}

export function formatNavDate(date: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [, m, d] = date.split('-');
    return `${m}${d}`;
  }
  return date;
}

interface LsjzRow {
  FSRQ: string;
  DWJZ: string;
  LJJZ: string;
  JZZZL: string;
}

/** 拉取近 N 条历史净值（天天基金 lsjz 接口） */
export async function fetchFundNavHistory(
  code: string,
  pageSize = 30,
): Promise<import('../types').NavHistoryItem[]> {
  const params = new URLSearchParams({
    fundCode: code,
    pageIndex: '1',
    pageSize: String(pageSize),
    startDate: '',
    endDate: '',
  });
  const res = await fetch(`/api/fund/f10/lsjz?${params}`);
  if (!res.ok) throw new Error('净值历史加载失败');

  const data = (await res.json()) as {
    Data?: { LSJZList?: LsjzRow[] };
  };
  const list = data.Data?.LSJZList ?? [];
  return list.map((item) => ({
    date: item.FSRQ,
    unitNav: parseFloat(item.DWJZ),
    accumulatedNav: parseFloat(item.LJJZ),
    dailyChange: parsePercent(item.JZZZL),
  }));
}

/** 天天基金 lsjz 接口 pageSize 上限约 200，超过会返回空 Data */
const LSJZ_PAGE_SIZE = 200;

/** 按日期范围拉取净值，用于批量定投 */
export async function fetchNavMapForRange(
  code: string,
  startDate: string,
  endDate: string,
): Promise<Map<string, import('../types').NavHistoryItem>> {
  const map = new Map<string, import('../types').NavHistoryItem>();
  let pageIndex = 1;

  while (pageIndex <= 10) {
    const params = new URLSearchParams({
      fundCode: code,
      pageIndex: String(pageIndex),
      pageSize: String(LSJZ_PAGE_SIZE),
      startDate: '',
      endDate: '',
    });
    const res = await fetch(`/api/fund/f10/lsjz?${params}`);
    if (!res.ok) break;

    const data = (await res.json()) as {
      Data?: { LSJZList?: LsjzRow[] };
    };
    const list = data.Data?.LSJZList ?? [];
    if (list.length === 0) break;

    let passedStart = false;
    for (const item of list) {
      if (startDate && compareDate(item.FSRQ, startDate) < 0) {
        passedStart = true;
        continue;
      }
      if (endDate && compareDate(item.FSRQ, endDate) > 0) continue;
      map.set(item.FSRQ, {
        date: item.FSRQ,
        unitNav: parseFloat(item.DWJZ),
        accumulatedNav: parseFloat(item.LJJZ),
        dailyChange: parsePercent(item.JZZZL),
      });
    }

    if (passedStart && startDate) break;
    if (list.length < LSJZ_PAGE_SIZE) break;
    pageIndex += 1;
  }

  return map;
}

/** 根据基金交易记录的日期范围拉取净值 */
export async function fetchNavMapForFund(
  fund: Fund,
): Promise<Map<string, NavHistoryItem>> {
  const range = getFundDateRange(fund);
  if (!range) {
    return fetchNavMapForRange(
      fund.code,
      formatDateISO(new Date(Date.now() - 90 * 86400000)),
      formatDateISO(new Date()),
    );
  }
  return fetchNavMapForRange(fund.code, range.start, range.end);
}
