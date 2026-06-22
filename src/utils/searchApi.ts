import type { FundSearchResult, HotFundItem } from '../types';

interface SearchApiItem {
  CODE: string;
  NAME: string;
  CATEGORYDESC?: string;
  FundBaseInfo?: {
    FTYPE?: string;
    JJGS?: string;
    DWJZ?: number;
    FSRQ?: string;
  };
  ZTJJInfo?: { TTYPENAME: string }[];
}

function mapSearchItem(item: SearchApiItem): FundSearchResult {
  return {
    code: item.CODE,
    name: item.NAME.replace(/<\/?[^>]+(>|$)/g, ''),
    sector: item.ZTJJInfo?.[0]?.TTYPENAME,
    fundType: item.FundBaseInfo?.FTYPE ?? item.CATEGORYDESC,
    company: item.FundBaseInfo?.JJGS,
    unitNav: item.FundBaseInfo?.DWJZ,
    navDate: item.FundBaseInfo?.FSRQ,
  };
}

export async function searchFunds(keyword: string): Promise<FundSearchResult[]> {
  if (!keyword.trim()) return [];

  const params = new URLSearchParams({
    m: '1',
    key: keyword.trim(),
    _: String(Date.now()),
  });

  const res = await fetch(
    `/api/search/FundSearch/api/FundSearchAPI.ashx?${params}`,
  );
  if (!res.ok) throw new Error('搜索请求失败');

  const data = (await res.json()) as {
    ErrCode?: number;
    Datas?: SearchApiItem[];
  };

  if (data.ErrCode !== 0 || !data.Datas) return [];
  return data.Datas.slice(0, 20).map(mapSearchItem);
}

export async function fetchHotFunds(): Promise<HotFundItem[]> {
  const params = new URLSearchParams({
    op: 'ph',
    dt: 'kf',
    ft: 'all',
    rs: '',
    gs: '0',
    sc: 'rzdf',
    st: 'desc',
    sd: '',
    ed: '',
    pi: '1',
    pn: '10',
    dx: '1',
    v: '1',
  });

  const res = await fetch(`/api/rank/data/rankhandler.aspx?${params}`);
  if (!res.ok) throw new Error('热搜加载失败');

  const text = await res.text();
  const match = text.match(/var rankData\s*=\s*(\{[\s\S]*?\});/);
  if (!match) return getFallbackHotFunds();

  try {
    const parsed = JSON.parse(match[1]) as { datas?: string[] };
    return (parsed.datas ?? []).slice(0, 10).map((row, i) => {
      const parts = row.split(',');
      const dailyChange = parseFloat(parts[6]);
      return {
        rank: i + 1,
        code: parts[0],
        name: parts[1],
        sector: undefined,
        dailyChange: Number.isFinite(dailyChange) ? dailyChange : undefined,
      };
    });
  } catch {
    return getFallbackHotFunds();
  }
}

function getFallbackHotFunds(): HotFundItem[] {
  return [
    { rank: 1, code: '012734', name: '华夏上证科创板半导体ETF联接C', sector: '半导体' },
    { rank: 2, code: '022500', name: '国泰海通中证全指通信设备ETF联接C', sector: 'CPO' },
    { rank: 3, code: '023894', name: '华夏中证5G通信主题ETF联接C', sector: '通信' },
    { rank: 4, code: '018123', name: '永赢先进制造智选混合C', sector: '人形机器人' },
    { rank: 5, code: '015916', name: '永赢医药创新智选混合C', sector: 'AI医疗' },
    { rank: 6, code: '016708', name: '华夏有色金属ETF联接C', sector: '工业金属' },
    { rank: 7, code: '018463', name: '德邦稳盈增长灵活配置混合C', sector: 'PCB' },
    { rank: 8, code: '017811', name: '东方人工智能主题混合C', sector: '国产算力' },
    { rank: 9, code: '015790', name: '永赢高端装备智选混合C', sector: '可控核聚变' },
    { rank: 10, code: '015968', name: '永赢半导体产业智选混合C', sector: '存储芯片' },
  ];
}

export const HOT_SECTORS = [
  { name: '算力租赁', changePct: 3.42 },
  { name: 'PCB', changePct: 2.87 },
  { name: '国产算力', changePct: 2.65 },
  { name: 'CPO', changePct: 2.31 },
  { name: '半导体', changePct: 1.98 },
  { name: '通信', changePct: 1.76 },
  { name: '有色期货', changePct: -0.33 },
  { name: '创新药', changePct: 0.54 },
];

export function loadRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem('recent-searches') ?? '[]') as string[];
  } catch {
    return [];
  }
}

export function saveRecentSearch(keyword: string): void {
  const list = loadRecentSearches().filter((k) => k !== keyword);
  list.unshift(keyword);
  localStorage.setItem('recent-searches', JSON.stringify(list.slice(0, 8)));
}
