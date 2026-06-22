import { useEffect, useState } from 'react';
import {
  fetchMarketIndices,
  getFundDistribution,
  getSectorOverview,
} from '../utils/marketApi';
import type { MarketIndex } from '../types';
import { profitColor } from '../utils/calculations';

export function MarketPage() {
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const sectors = getSectorOverview();
  const distribution = getFundDistribution();
  const maxCount = Math.max(...distribution.map((d) => d.count));

  useEffect(() => {
    fetchMarketIndices().then(setIndices).catch(() => undefined);
  }, []);

  const upCount = 17537;
  const downCount = 2283;

  return (
    <div className="market-page">
      <div className="page-head">
        <div className="page-head-main">
          <h1 className="page-title">行情</h1>
          <p className="page-desc">大盘指数与市场概览</p>
        </div>
      </div>

      <div className="index-cards">
        {indices.map((idx) => (
          <div
            key={idx.code}
            className={`index-card${idx.change >= 0 ? ' up' : ' down'}`}
          >
            <div className="index-card-name">{idx.name}</div>
            <div className="index-card-price">{idx.price.toFixed(2)}</div>
            <div
              className="index-card-change"
              style={{ color: profitColor(idx.changePct) }}
            >
              {idx.change >= 0 ? '+' : ''}
              {idx.change.toFixed(2)} {idx.changePct >= 0 ? '+' : ''}
              {idx.changePct.toFixed(2)}%
            </div>
          </div>
        ))}
      </div>

      <section className="market-section">
        <h3 className="market-section-title">基金涨跌分布</h3>
        <div className="distribution-chart">
          {distribution.map((bar) => (
            <div key={bar.label} className="distribution-bar-wrap">
              <div className="distribution-count">{bar.count}</div>
              <div
                className="distribution-bar"
                style={{ height: `${(bar.count / maxCount) * 80 + 8}px` }}
              />
              <div className="distribution-label">{bar.label}</div>
            </div>
          ))}
        </div>
        <div className="distribution-summary">
          <span className="down-side">跌 {downCount}</span>
          <div className="distribution-track">
            <div
              className="distribution-fill-down"
              style={{ width: `${(downCount / (upCount + downCount)) * 100}%` }}
            />
            <div className="distribution-fill-up" />
          </div>
          <span className="up-side">涨 {upCount}</span>
        </div>
      </section>

      <section className="market-section">
        <h3 className="market-section-title">板块总览</h3>
        <div className="sector-list">
          {sectors.map((s) => (
            <div key={s.name} className="sector-row">
              <div className="sector-left">
                <div className="sector-name">{s.name}</div>
                <div className="sector-meta">
                  {s.fundCount} 支基金 · {s.streak ?? ''}
                </div>
              </div>
              <div
                className="sector-change"
                style={{ color: profitColor(s.changePct / 100) }}
              >
                {s.changePct >= 0 ? '+' : ''}
                {s.changePct.toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
