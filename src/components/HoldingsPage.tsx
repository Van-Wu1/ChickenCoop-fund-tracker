import { useState } from 'react';
import {
  formatMoney,
  formatDisplayDate,
  formatPercent,
  getFundStats,
  getPortfolioStats,
  profitColor,
} from '../utils/calculations';
import type { Fund } from '../types';
import type { SyncResult } from '../utils/applyNavUpdate';
import { PnLCalendar } from './PnLCalendar';

interface HoldingsPageProps {
  funds: Fund[];
  onSelectFund: (id: string) => void;
  onAddFund: () => void;
  onDeleteFund: (id: string) => void;
  onSyncAll: () => Promise<SyncResult[]>;
}

export function HoldingsPage({
  funds,
  onSelectFund,
  onAddFund,
  onDeleteFund,
  onSyncAll,
}: HoldingsPageProps) {
  const stats = getPortfolioStats(funds);
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await onSyncAll();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="holdings-page">
      <div className="holdings-overview">
        <div className="stat-grid">
          <div className="stat-card">
            <span className="stat-label">账户资产</span>
            <div className="stat-value">
              ¥{formatMoney(stats.totalMarketValue)}
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-label">今日收益</span>
            <div
              className="stat-value"
              style={{ color: profitColor(stats.totalDailyProfit) }}
            >
              {stats.totalDailyProfit >= 0 ? '+' : ''}
              {formatMoney(stats.totalDailyProfit)}
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-label">累计收益</span>
            <div
              className="stat-value"
              style={{ color: profitColor(stats.totalProfit) }}
            >
              {stats.totalProfit >= 0 ? '+' : ''}
              {formatMoney(stats.totalProfit)}
            </div>
          </div>
        </div>

        <div className="pnl-calendar-card">
          <PnLCalendar funds={funds} />
        </div>
      </div>

      <div className="holdings-table-toolbar">
        <button
          className="btn btn-sm"
          disabled={syncing}
          onClick={handleSync}
          type="button"
        >
          {syncing ? '同步中…' : '同步净值'}
        </button>
        <button className="btn btn-primary btn-sm" onClick={onAddFund} type="button">
          新增持有
        </button>
      </div>

      <div className="panel holdings-table-panel">
        <table className="holdings-table">
          <colgroup>
            <col className="holdings-col-fund" />
            <col className="holdings-col-data" />
            <col className="holdings-col-data" />
            <col className="holdings-col-data" />
            <col className="holdings-col-data" />
            <col className="holdings-col-data" />
            <col className="holdings-col-action" />
          </colgroup>
          <thead>
            <tr>
              <th>基金</th>
              <th>代码</th>
              <th>当日涨跌</th>
              <th>板块</th>
              <th>最新收益（日期）</th>
              <th>累计收益</th>
              <th className="col-action-head" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {funds.map((fund) => {
              const s = getFundStats(fund);
              const latest = fund.transactions[fund.transactions.length - 1];
              const navDate = latest?.date ? formatDisplayDate(latest.date) : '';
              const profitDateLabel = s.profitDate
                ? formatDisplayDate(s.profitDate)
                : '—';

              return (
                <tr
                  key={fund.id}
                  className="holdings-table-row"
                  onClick={() => onSelectFund(fund.id)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectFund(fund.id);
                    }
                  }}
                >
                  <td className="col-fund">
                    <div className="holding-name">{fund.name}</div>
                    <div className="holding-sub">
                      <span>¥{formatMoney(s.cost)}</span>
                      {navDate && <span className="tag tag-date">{navDate}</span>}
                      {latest?.amount > 0 && (
                        <span className="tag tag-ding">定</span>
                      )}
                    </div>
                  </td>
                  <td className="col-code">{fund.code}</td>
                  <td
                    className="col-num holding-change"
                    style={{
                      color:
                        s.dailyChange !== null
                          ? profitColor(s.dailyChange)
                          : 'var(--text-muted)',
                    }}
                  >
                    {s.dailyChange !== null
                      ? formatPercent(s.dailyChange)
                      : '—'}
                  </td>
                  <td className="col-sector holding-sector">
                    {fund.sector ?? '—'}
                  </td>
                  <td className="col-num">
                    <div className="col-stacked">
                      <span
                        className="cell-primary"
                        style={{ color: profitColor(s.dailyProfit) }}
                      >
                        {s.dailyProfit >= 0 ? '+' : ''}
                        {formatMoney(s.dailyProfit)}
                      </span>
                      <span className="cell-secondary">{profitDateLabel}</span>
                    </div>
                  </td>
                  <td className="col-num">
                    <div className="col-stacked">
                      <span
                        className="cell-primary"
                        style={{ color: profitColor(s.profit) }}
                      >
                        {s.profit >= 0 ? '+' : ''}
                        {formatMoney(s.profit)}
                      </span>
                      <span
                        className="cell-secondary"
                        style={{ color: profitColor(s.profit) }}
                      >
                        {formatPercent(s.profitRate)}
                      </span>
                    </div>
                  </td>
                  <td className="col-action">
                    <button
                      className="holding-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFund(fund.id);
                      }}
                      title="删除持有"
                      type="button"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
