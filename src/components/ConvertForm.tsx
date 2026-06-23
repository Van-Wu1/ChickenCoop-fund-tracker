import { useMemo, useState } from 'react';
import { FormRow, FormSection } from './FormSection';
import type { ConvertFundInput, Fund } from '../types';
import { formatMoney, getFundStats } from '../utils/calculations';
import { fetchNavOnDate } from '../utils/fundOperations';

interface ConvertFormProps {
  fund: Fund;
  onBack: () => void;
  onSubmit: (input: ConvertFundInput) => Promise<void>;
}

export function ConvertForm({ fund, onBack, onSubmit }: ConvertFormProps) {
  const stats = getFundStats(fund);
  const [date, setDate] = useState('');
  const [targetCode, setTargetCode] = useState('');
  const [targetName, setTargetName] = useState('');
  const [sourceUnitNav, setSourceUnitNav] = useState('');
  const [targetConfirmedNav, setTargetConfirmedNav] = useState('');
  const [sourceFee, setSourceFee] = useState('0');
  const [targetFee, setTargetFee] = useState('0');
  const [fetching, setFetching] = useState<'source' | 'target' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const redemptionAmount = useMemo(() => {
    const nav = parseFloat(sourceUnitNav);
    if (!Number.isFinite(nav) || nav <= 0) return null;
    return stats.holdingShares * nav;
  }, [sourceUnitNav, stats.holdingShares]);

  const handleFetchNav = async (side: 'source' | 'target') => {
    if (!date) {
      setMsg('请先选择转化日期');
      return;
    }
    const code = side === 'source' ? fund.code : targetCode.trim();
    if (!code) {
      setMsg('请先填写目标基金代码');
      return;
    }
    setFetching(side);
    setMsg(null);
    try {
      const nav = await fetchNavOnDate(code, date);
      if (nav === null) {
        setMsg('未找到该日净值，请手动填写');
      } else if (side === 'source') {
        setSourceUnitNav(String(nav));
      } else {
        setTargetConfirmedNav(String(nav));
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '拉取净值失败');
    } finally {
      setFetching(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const srcNav = parseFloat(sourceUnitNav);
    const tgtNav = parseFloat(targetConfirmedNav);
    if (!Number.isFinite(srcNav) || srcNav <= 0) {
      setMsg('请填写源基金赎回净值');
      return;
    }
    if (!Number.isFinite(tgtNav) || tgtNav <= 0) {
      setMsg('请填写目标基金确认净值');
      return;
    }
    if (!targetCode.trim()) {
      setMsg('请填写目标基金代码');
      return;
    }

    setSubmitting(true);
    setMsg(null);
    try {
      await onSubmit({
        date,
        targetCode: targetCode.trim(),
        targetName: targetName.trim() || `基金 ${targetCode.trim()}`,
        sourceUnitNav: srcNav,
        targetConfirmedNav: tgtNav,
        sourceFee: parseFloat(sourceFee) || 0,
        targetFee: parseFloat(targetFee) || 0,
        redemptionAmount: redemptionAmount ?? undefined,
      });
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '转化失败');
      setSubmitting(false);
    }
  };

  const formId = 'convert-form';

  return (
    <div className="fund-detail-page">
      <header className="page-header">
        <button className="nav-btn" onClick={onBack} type="button">
          取消
        </button>
        <h1>基金转化</h1>
        <button
          className="nav-btn nav-btn-primary"
          disabled={submitting}
          form={formId}
          type="submit"
        >
          {submitting ? '处理中…' : '确认转化'}
        </button>
      </header>

      <p className="form-context">从 {fund.name} 转出</p>
      <p className="form-hint">
        将把当前 {stats.holdingShares.toFixed(4)} 份全部赎回，并转入目标基金。源基金将标记为已清仓。
      </p>

      <form id={formId} onSubmit={handleSubmit}>
        <FormSection title="转化日期">
          <FormRow label="日期">
            <input
              className="form-input form-input-date"
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </FormRow>
        </FormSection>

        <FormSection title="源基金（赎回）">
          <FormRow label="赎回净值">
            <div className="form-inline">
              <input
                className="form-input"
                inputMode="decimal"
                required
                step="0.0001"
                type="number"
                value={sourceUnitNav}
                onChange={(e) => setSourceUnitNav(e.target.value)}
              />
              <button
                className="btn btn-sm"
                disabled={fetching !== null || !date}
                onClick={() => handleFetchNav('source')}
                type="button"
              >
                {fetching === 'source' ? '拉取中…' : '拉取净值'}
              </button>
            </div>
          </FormRow>
          <FormRow label="赎回手续费">
            <input
              className="form-input"
              inputMode="decimal"
              step="0.01"
              type="number"
              value={sourceFee}
              onChange={(e) => setSourceFee(e.target.value)}
            />
          </FormRow>
          {redemptionAmount !== null && (
            <FormRow
              label="预估赎回金额"
              value={`¥${formatMoney(redemptionAmount)}`}
            />
          )}
        </FormSection>

        <FormSection title="目标基金（申购）">
          <FormRow label="基金代码">
            <input
              className="form-input"
              placeholder="如 012922"
              required
              value={targetCode}
              onChange={(e) => setTargetCode(e.target.value)}
            />
          </FormRow>
          <FormRow label="基金名称">
            <input
              className="form-input"
              placeholder="目标基金名称"
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
            />
          </FormRow>
          <FormRow label="确认净值">
            <div className="form-inline">
              <input
                className="form-input"
                inputMode="decimal"
                required
                step="0.0001"
                type="number"
                value={targetConfirmedNav}
                onChange={(e) => setTargetConfirmedNav(e.target.value)}
              />
              <button
                className="btn btn-sm"
                disabled={fetching !== null || !date || !targetCode.trim()}
                onClick={() => handleFetchNav('target')}
                type="button"
              >
                {fetching === 'target' ? '拉取中…' : '拉取净值'}
              </button>
            </div>
          </FormRow>
          <FormRow label="申购手续费">
            <input
              className="form-input"
              inputMode="decimal"
              step="0.01"
              type="number"
              value={targetFee}
              onChange={(e) => setTargetFee(e.target.value)}
            />
          </FormRow>
        </FormSection>

        {msg && <p className="form-hint form-hint-warn">{msg}</p>}
      </form>
    </div>
  );
}
