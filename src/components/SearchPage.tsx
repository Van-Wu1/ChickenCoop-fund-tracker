import { useEffect, useState } from 'react';
import {
  fetchHotFunds,
  loadRecentSearches,
  saveRecentSearch,
  searchFunds,
} from '../utils/searchApi';
import type { FundSearchResult, HotFundItem } from '../types';

interface SearchPageProps {
  holdingCodes: string[];
  onClose: () => void;
  onAddHolding: (item: FundSearchResult) => void;
  onOpenFund: (code: string, name?: string, sector?: string) => void;
}

export function SearchPage({
  holdingCodes,
  onClose,
  onAddHolding,
  onOpenFund,
}: SearchPageProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FundSearchResult[]>([]);
  const [hotFunds, setHotFunds] = useState<HotFundItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState(loadRecentSearches);

  useEffect(() => {
    fetchHotFunds().then(setHotFunds).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await searchFunds(query));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query]);

  const handleSelect = (item: FundSearchResult) => {
    saveRecentSearch(item.name);
    setRecent(loadRecentSearches());
    onOpenFund(item.code, item.name, item.sector);
  };

  const rankColor = (rank: number) => {
    if (rank === 1) return '#ff6b35';
    if (rank === 2) return '#4a90e2';
    if (rank === 3) return '#f5a623';
    return '#bbb';
  };

  return (
    <div className="search-overlay">
      <div className="search-header">
        <button className="search-back" onClick={onClose} type="button">
          ‹ 返回
        </button>
        <div className="search-input-wrap">
          <span className="search-icon">⌕</span>
          <input
            autoFocus
            className="search-input"
            placeholder="输入基金名称或代码"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="search-clear"
              onClick={() => setQuery('')}
              type="button"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {!query && (
        <>
          {recent.length > 0 && (
            <div className="search-section">
              <h3 className="search-section-title">最近搜索</h3>
              <div className="recent-searches">
                {recent.map((r) => (
                  <button
                    key={r}
                    className="recent-chip"
                    onClick={() => setQuery(r)}
                    type="button"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="search-section">
            <h3 className="search-section-title">热搜基金</h3>
            <div className="hot-list">
              {hotFunds.map((item) => (
                <button
                  key={item.code}
                  className="hot-item"
                  onClick={() =>
                    handleSelect({
                      code: item.code,
                      name: item.name,
                      sector: item.sector,
                    })
                  }
                  type="button"
                >
                  <span
                    className="hot-rank"
                    style={{ color: rankColor(item.rank) }}
                  >
                    {item.rank}
                  </span>
                  <span className="hot-name">{item.name}</span>
                  <span className="hot-sector">{item.sector ?? '—'}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {query && (
        <div className="search-results">
          {loading && <p className="search-status">搜索中…</p>}
          {!loading && results.length === 0 && (
            <p className="search-status">未找到相关基金</p>
          )}
          {results.map((item) => {
            const isHolding = holdingCodes.includes(item.code);
            return (
              <div key={item.code} className="search-result-item">
                <button
                  className="search-result-main"
                  onClick={() => handleSelect(item)}
                  type="button"
                >
                  <div className="search-result-name">{item.name}</div>
                  <div className="search-result-meta">
                    <span>{item.code}</span>
                    {item.fundType && <span>{item.fundType}</span>}
                    {item.sector && <span className="sector-tag">{item.sector}</span>}
                  </div>
                </button>
                <div className="search-result-actions">
                  {!isHolding ? (
                    <button
                      className="pill-btn"
                      onClick={() => onAddHolding(item)}
                      type="button"
                    >
                      加持有
                    </button>
                  ) : (
                    <span className="added-tag">已持有</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
