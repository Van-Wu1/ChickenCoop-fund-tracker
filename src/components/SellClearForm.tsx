import { useMemo, useState } from 'react';
import { FormRow, FormSection } from './FormSection';
import type { Fund, SellClearInput } from '../types';
import { formatMoney, getFundStats } from '../utils/calculations';
import { fetchNavOnDate } from '../utils/fundOperations';

interface SellClearFormProps {
  fund: Fund;
  onBack: () => void;
  onSubmit: (input: SellClearInput) => void;
}

export function SellClearForm({ fund, onBack, onSubmit }: SellClearFormProps) {
  const stats = getFundStats(fund);
  const [date, setDate] = useState('');
  const [unitNav, setUnitNav] = useState('');
  const [redemptionAmount, setRedemptionAmount] = useState('');
  const [fee, setFee] = useState('0');
  const [fetching, setFetching] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const estimated = useMemo(() => {
    const nav = parseFloat(unitNav);
    if (!Number.isFinite(nav) || nav <= 0) return null;
    return stats.holdingShares * nav;
  }, [stats.holdingShares, unitNav]);

  const handleFetchNav = async () => {
    if (!date) {
      setMsg('请先选择卖出日期');
      return;
    }
    setFetching(true);
    setMsg(null);
    try {
      const nav = await fetchNavOnDate(fund.code, date);
      if (nav === null) {
        setMsg('未找到该日净值，请手动填写');
      } else {
        setUnitNav(String(nav));
        setRedemptionAmount('');
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '拉取净值失败');
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nav = parseFloat(unitNav);
    if (!Number.isFinite(nav) || nav <= 0) {
      setMsg('请填写有效的卖出净值');
      return;
    }
    const amount = redemptionAmount
      ? parseFloat(redemptionAmount)
      : stats.holdingShares * nav;
    if (!Number.isFinite(amount) || amount <= 0) {
      setMsg('请填写有效的到账金额');
      return;
    }

    onSubmit({
      date,
      unitNav: nav,
      fee: parseFloat(fee) || 0,
      redemptionAmount: amount,
    });
  };

  const formId = 'sell-clear-form';

  return (
    <div className="fund-detail-page">
      <header className="page-header">
        <button className="nav-btn" onClick={onBack} type="button">
          取消
        </button>
        <h1>卖出 / 清仓</h1>
        <button
          className="nav-btn nav-btn-primary"
          form={formId}
          type="submit"
        >
          确认清仓
        </button>
      </header>

      <p className="form-context">{fund.name}</p>
      <p className="form-hint">
        清仓后基金仍保留在持有列表，可查看历史盈亏；当前份额{' '}
        <strong>{stats.holdingShares.toFixed(4)}</strong>，成本 ¥
        {formatMoney(stats.cost)}
      </p>

      <form id={formId} onSubmit={handleSubmit}>
        <FormSection title="卖出信息" footer="确认后将生成一条卖出记录并清零持仓">
          <FormRow label="卖出日期">
            <input
              className="form-input form-input-date"
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </FormRow>
          <FormRow label="卖出净值">
            <div className="form-inline">
              <input
                className="form-input"
                inputMode="decimal"
                placeholder="0.0000"
                required
                step="0.0001"
                type="number"
                value={unitNav}
                onChange={(e) => setUnitNav(e.target.value)}
              />
              <button
                className="btn btn-sm"
                disabled={fetching || !date}
                onClick={handleFetchNav}
                type="button"
              >
                {fetching ? '拉取中…' : '拉取净值'}
              </button>
            </div>
          </FormRow>
          <FormRow label="到账金额">
            <input
              className="form-input"
              inputMode="decimal"
              placeholder={estimated ? String(estimated.toFixed(2)) : '默认=份额×净值'}
              step="0.01"
              type="number"
              value={redemptionAmount}
              onChange={(e) => setRedemptionAmount(e.target.value)}
            />
          </FormRow>
          <FormRow label="手续费">
            <input
              className="form-input"
              inputMode="decimal"
              step="0.01"
              type="number"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
            />
          </FormRow>
        </FormSection>
        {msg && <p className="form-hint form-hint-warn">{msg}</p>}
      </form>
    </div>
  );
}
