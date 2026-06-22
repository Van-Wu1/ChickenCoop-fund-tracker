import { useEffect, useState } from 'react';
import { formatPercent, profitColor } from '../utils/calculations';
import { fetchFundNavHistory } from '../utils/fundApi';
import type { NavHistoryItem } from '../types';

interface NavHistoryTableProps {
  fundCode: string;
}

export function NavHistoryTable({ fundCode }: NavHistoryTableProps) {
  const [rows, setRows] = useState<NavHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchFundNavHistory(fundCode, 30)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载失败');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fundCode]);

  if (loading) {
    return <p className="table-status">净值数据加载中…</p>;
  }

  if (error) {
    return <p className="table-status table-status-error">{error}</p>;
  }

  if (rows.length === 0) {
    return <p className="table-status">暂无净值数据</p>;
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>日期</th>
            <th>单位净值</th>
            <th>累计净值</th>
            <th>日涨幅</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.date}>
              <td>{row.date}</td>
              <td>{row.unitNav.toFixed(4)}</td>
              <td>{row.accumulatedNav.toFixed(4)}</td>
              <td
                style={{
                  color:
                    row.dailyChange !== null
                      ? profitColor(row.dailyChange)
                      : undefined,
                }}
              >
                {row.dailyChange !== null
                  ? formatPercent(row.dailyChange)
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
