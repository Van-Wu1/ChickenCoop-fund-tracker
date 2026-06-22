import type { MarketIndex, SectorItem } from '../types';
import { HOT_SECTORS } from './searchApi';

interface IndexRaw {
  f12: string;
  f14: string;
  f2: number;
  f3: number;
  f4: number;
}

export async function fetchMarketIndices(): Promise<MarketIndex[]> {
  const params = new URLSearchParams({
    fields: 'f2,f3,f4,f12,f14',
    secids: '1.000001,0.399001,0.399006,0.899050',
  });

  const res = await fetch(`/api/market/api/qt/ulist.np/get?${params}`);
  if (!res.ok) throw new Error('指数加载失败');

  const data = (await res.json()) as { data?: { diff?: IndexRaw[] } };
  return (data.data?.diff ?? []).map((item) => ({
    code: item.f12,
    name: item.f14,
    price: item.f2 / 100,
    change: item.f4 / 100,
    changePct: item.f3 / 100,
  }));
}

export function getSectorOverview(): SectorItem[] {
  return HOT_SECTORS.map((s, i) => ({
    name: s.name,
    fundCount: 120 + i * 37,
    changePct: s.changePct,
    streak: s.changePct > 0 ? `连涨 ${1 + (i % 3)} 天` : undefined,
  }));
}

export function getFundDistribution() {
  return [
    { label: '≤-5%', count: 228, pct: 1.1 },
    { label: '-5~-3%', count: 412, pct: 2.0 },
    { label: '-3~-1%', count: 1643, pct: 8.1 },
    { label: '-1~0%', count: 2891, pct: 14.3 },
    { label: '0~1%', count: 5124, pct: 25.3 },
    { label: '1~3%', count: 6892, pct: 34.0 },
    { label: '≥3%', count: 3521, pct: 17.4 },
  ];
}
