import { useEffect, useRef, useState } from 'react';
import { NavHistoryTable } from './NavHistoryTable';
import {
  compareDate,
  formatDisplayDate,
  formatMoney,
  formatPercent,
  getFundStats,
  isFundClosed,
  profitColor,
} from '../utils/calculations';
import { fundNeedsNavBackfill } from '../utils/backfillNav';
import type { Fund, Transaction } from '../types';
import type { SyncResult } from '../utils/applyNavUpdate';

interface FundDetailProps {
  fund: Fund;
  onBack: () => void;
  onAddRecord: () => void;
  onBatchDca: () => void;
  onConvert: () => void;
  onSellClear: () => void;
  onEditRecord: (tx: Transaction) => void;
  onDeleteRecord: (tx: Transaction) => void;
  onDeleteFund: () => void;
  onSync: (code: string) => Promise<SyncResult>;
}

function recordType(tx: Transaction): string {
  if (tx.kind === 'sell') return '卖出清仓';
  if (tx.amount > 0) return '定投购入';
  if (tx.unitNav !== null) return '收盘更新';
  return '待完善';
}

export function FundDetail({
  fund,
  onBack,
  onAddRecord,
  onBatchDca,
  onConvert,
  onSellClear,
  onEditRecord,
  onDeleteRecord,
  onDeleteFund,
  onSync,
}: FundDetailProps) {
  const stats = getFundStats(fund);
  const closed = isFundClosed(fund);
  const records = [...fund.transactions.filter((t) => t.date)].sort((a, b) =>
    compareDate(b.date, a.date),
  );
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const syncGenRef = useRef(0);

  useEffect(() => {
    if (!fundNeedsNavBackfill(fund) || isFundClosed(fund)) return;

    const gen = ++syncGenRef.current;
    let cancelled = false;

    (async () => {
      setSyncing(true);
      setSyncMsg('正在自动补全净值…');
      try {
        const result = await onSync(fund.code);
        if (!cancelled && syncGenRef.current === gen) {
          setSyncMsg(result.message);
        }
      } catch (err) {
        if (!cancelled && syncGenRef.current === gen) {
          setSyncMsg(err instanceof Error ? err.message : '补全失败');
        }
      } finally {
        if (!cancelled && syncGenRef.current === gen) {
          setSyncing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      setSyncing(false);
    };
    // 仅在切换基金时尝试一次自动补全，避免因 fund 更新反复触发
  }, [fund.id, fund.code, onSync]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const result = await onSync(fund.code);
      setSyncMsg(result.message);
    } catch (err) {
      setSyncMsg(err instanceof Error ? err.message : '同步失败');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fund-detail-page fund-detail-wide">
      <header className="page-header">
        <button className="nav-btn" onClick={onBack} type="button">
          ‹ 返回
        </button>
        <h1>{fund.name}</h1>
        <div className="header-actions">
          {!closed && (
            <>
              <button
                className="header-action-btn btn btn-sm"
                onClick={onConvert}
                type="button"
              >
                转化
              </button>
              <button
                className="header-action-btn btn btn-sm"
                onClick={onSellClear}
                type="button"
              >
                卖出/清仓
              </button>
              <button
                className="header-action-btn btn btn-sm"
                onClick={onBatchDca}
                type="button"
              >
                批量定投
              </button>
              <button
                className="header-action-btn btn btn-primary btn-sm"
                onClick={onAddRecord}
                type="button"
              >
                添加记录
              </button>
            </>
          )}
          <button
            className="header-action-btn btn btn-danger btn-sm"
            onClick={onDeleteFund}
            type="button"
          >
            删除持有
          </button>
        </div>
      </header>

      {closed && (
        <p className="fund-closed-banner">已清仓 · 保留历史记录与累计盈亏</p>
      )}

      <div className="detail-summary">
        <div className="summary-item">
          <span className="summary-label">{closed ? '已实现市值' : '持有市值'}</span>
          <span className="summary-value">
            {closed ? '—' : `¥${formatMoney(stats.marketValue)}`}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">{closed ? '持仓成本' : '持有成本'}</span>
          <span className="summary-value">
            {closed ? '—' : `¥${formatMoney(stats.cost)}`}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">
            累计收益
            {stats.profitDate && (
              <span className="summary-date-tag">
                {formatDisplayDate(stats.profitDate)}
              </span>
            )}
          </span>
          <span
            className="summary-value"
            style={{ color: profitColor(stats.profit) }}
          >
            {stats.profit >= 0 ? '+' : ''}
            {formatMoney(stats.profit)}
            {stats.profitDate && ` (${formatPercent(stats.profitRate)})`}
          </span>
        </div>
        <button
          className="btn btn-sm"
          disabled={syncing || closed}
          onClick={handleSync}
          type="button"
        >
          {syncing ? '同步中…' : '同步净值'}
        </button>
        {syncMsg && <span className="sync-inline-msg">{syncMsg}</span>}
      </div>

      <section className="detail-section">
        <h2 className="detail-section-title">近 30 日净值</h2>
        <NavHistoryTable fundCode={fund.code} />
      </section>

      <section className="detail-section">
        <div className="detail-section-head">
          <h2 className="detail-section-title">交易记录</h2>
          <span className="detail-section-meta">共 {records.length} 条 · 点击行可编辑</span>
        </div>
        {records.length === 0 ? (
          <p className="table-status">暂无交易记录，可添加单条或使用批量定投</p>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table data-table-interactive">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>类型</th>
                  <th>投入金额</th>
                  <th>确认净值</th>
                  <th>确认份额</th>
                  <th>持有成本</th>
                  <th>收盘净值</th>
                  <th>持有市值</th>
                  <th>当日收益</th>
                  <th>累计收益</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((tx) => (
                  <tr key={tx.id} className="clickable-row">
                    <td onClick={() => onEditRecord(tx)}>
                      {formatDisplayDate(tx.date)}
                    </td>
                    <td onClick={() => onEditRecord(tx)}>
                      <span
                        className={`type-tag${tx.kind === 'sell' ? ' sell' : tx.amount > 0 ? ' buy' : ''}`}
                      >
                        {recordType(tx)}
                      </span>
                    </td>
                    <td onClick={() => onEditRecord(tx)}>
                      {tx.kind === 'sell'
                        ? `¥${formatMoney(tx.amount)}`
                        : tx.amount > 0
                          ? `¥${formatMoney(tx.amount)}`
                          : '—'}
                    </td>
                    <td onClick={() => onEditRecord(tx)}>
                      {tx.confirmedNav > 0 ? tx.confirmedNav.toFixed(4) : '—'}
                    </td>
                    <td onClick={() => onEditRecord(tx)}>
                      {tx.confirmedShares > 0
                        ? tx.confirmedShares.toFixed(4)
                        : '—'}
                    </td>
                    <td onClick={() => onEditRecord(tx)}>
                      ¥{formatMoney(tx.holdingAmount)}
                    </td>
                    <td onClick={() => onEditRecord(tx)}>
                      {tx.unitNav !== null ? tx.unitNav.toFixed(4) : '—'}
                    </td>
                    <td onClick={() => onEditRecord(tx)}>
                      {tx.marketValue !== null
                        ? `¥${formatMoney(tx.marketValue)}`
                        : '—'}
                    </td>
                    <td
                      onClick={() => onEditRecord(tx)}
                      style={{
                        color:
                          tx.dailyProfit !== null
                            ? profitColor(tx.dailyProfit)
                            : undefined,
                      }}
                    >
                      {tx.dailyProfit !== null
                        ? `${tx.dailyProfit >= 0 ? '+' : ''}${formatMoney(tx.dailyProfit)}`
                        : '—'}
                    </td>
                    <td
                      onClick={() => onEditRecord(tx)}
                      style={{
                        color:
                          tx.cumulativeProfit !== null
                            ? profitColor(tx.cumulativeProfit)
                            : undefined,
                      }}
                    >
                      {tx.cumulativeProfit !== null
                        ? `${tx.cumulativeProfit >= 0 ? '+' : ''}${formatMoney(tx.cumulativeProfit)}`
                        : '—'}
                    </td>
                    <td className="row-actions">
                      <button
                        className="row-edit-btn"
                        onClick={() => onEditRecord(tx)}
                        type="button"
                      >
                        编辑
                      </button>
                      <button
                        className="row-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteRecord(tx);
                        }}
                        type="button"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
