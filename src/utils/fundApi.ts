import type { Fund, FundNavQuote, NavHistoryItem } from '../types';
import { compareDate, formatDateISO, normalizeDateToISO } from './calculations';
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
  LJJZ: string;
  JZZZL: string;
}

interface LsjzResponse {
  Data?: { LSJZList?: LsjzItem[] };
}

function parsePercent(value: string | undefined): number | null {
  if (!value || value === '' || value === '--') return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n / 100 : null;
}

function lsjzItemToNav(item: LsjzItem): NavHistoryItem {
  const date = normalizeDateToISO(item.FSRQ);
  return {
    date,
    unitNav: parseFloat(item.DWJZ),
    accumulatedNav: parseFloat(item.LJJZ),
    dailyChange: parsePercent(item.JZZZL),
  };
}

function fetchJsonp<T>(
  url: string,
  callbackName: string,
  validate: (data: T) => boolean,
  timeoutMs = 12000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('请求超时'));
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timer);
      delete (window as unknown as Record<string, unknown>)[callbackName];
      script.remove();
    };

    (window as unknown as Record<string, unknown>)[callbackName] = (
      data: T,
    ) => {
      cleanup();
      if (!validate(data)) {
        reject(new Error('返回数据无效'));
        return;
      }
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('网络请求失败'));
    };

    script.src = url;
    document.head.appendChild(script);
  });
}

function fetchJsonpEstimate(code: string): Promise<JsonpPayload> {
  return fetchJsonp<JsonpPayload>(
    `https://fundgz.1234567.com.cn/js/${code}.js?rt=${Date.now()}`,
    'jsonpgz',
    (data) => Boolean(data?.fundcode),
  );
}

/** 历史净值 JSONP（不依赖 Vite 代理，静态部署也可用） */
function fetchLsjzJsonp(
  code: string,
  pageIndex: number,
  pageSize: number,
): Promise<LsjzItem[]> {
  const callbackName = `jsonp_lsjz_${code}_${pageIndex}_${Date.now()}`;
  const params = new URLSearchParams({
    fundCode: code,
    pageIndex: String(pageIndex),
    pageSize: String(pageSize),
    startDate: '',
    endDate: '',
    callback: callbackName,
    _: String(Date.now()),
  });

  return fetchJsonp<LsjzResponse>(
    `https://api.fund.eastmoney.com/f10/lsjz?${params}`,
    callbackName,
    (data) => Array.isArray(data?.Data?.LSJZList),
  ).then((data) => data.Data?.LSJZList ?? []);
}

async function fetchLsjzPage(
  code: string,
  pageIndex: number,
  pageSize: number,
): Promise<LsjzItem[]> {
  try {
    const params = new URLSearchParams({
      fundCode: code,
      pageIndex: String(pageIndex),
      pageSize: String(pageSize),
      startDate: '',
      endDate: '',
    });
    const res = await fetch(`/api/fund/f10/lsjz?${params}`);
    if (res.ok) {
      const data = (await res.json()) as LsjzResponse;
      const list = data.Data?.LSJZList ?? [];
      if (list.length > 0) return list;
    }
  } catch {
    // 无代理时走 JSONP
  }

  return fetchLsjzJsonp(code, pageIndex, pageSize);
}

async function fetchOfficialNav(code: string): Promise<LsjzItem | null> {
  const list = await fetchLsjzPage(code, 1, 1);
  return list[0] ?? null;
}

function fromJsonp(data: JsonpPayload): FundNavQuote {
  return {
    code: data.fundcode,
    name: data.name,
    navDate: normalizeDateToISO(data.jzrq),
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
    navDate: normalizeDateToISO(item.FSRQ),
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
    jsonpData = await fetchJsonpEstimate(code);
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

/** 拉取近 N 条历史净值（天天基金 lsjz 接口） */
export async function fetchFundNavHistory(
  code: string,
  pageSize = 30,
): Promise<NavHistoryItem[]> {
  const list = await fetchLsjzPage(code, 1, pageSize);
  return list.map(lsjzItemToNav);
}

/** 天天基金 lsjz 接口 pageSize 上限约 200，超过会返回空 Data */
const LSJZ_PAGE_SIZE = 200;

/** 按日期范围拉取净值，用于批量定投与同步补全 */
export async function fetchNavMapForRange(
  code: string,
  startDate: string,
  endDate: string,
): Promise<Map<string, NavHistoryItem>> {
  const map = new Map<string, NavHistoryItem>();
  let pageIndex = 1;

  while (pageIndex <= 10) {
    const list = await fetchLsjzPage(code, pageIndex, LSJZ_PAGE_SIZE);
    if (list.length === 0) break;

    let passedStart = false;
    for (const item of list) {
      const nav = lsjzItemToNav(item);
      if (startDate && compareDate(nav.date, startDate) < 0) {
        passedStart = true;
        continue;
      }
      if (endDate && compareDate(nav.date, endDate) > 0) continue;
      map.set(nav.date, nav);
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
