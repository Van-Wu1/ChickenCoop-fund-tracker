import { useMemo, useState } from 'react';
import { FormRow, FormSection } from './FormSection';
import type { BatchDcaInput } from '../types';
import { enumerateDates, formatDateISO } from '../utils/calculations';

interface BatchDcaFormProps {
  fundName: string;
  existingPurchaseDates: Set<string>;
  onSubmit: (batch: BatchDcaInput) => Promise<void>;
  onBack: () => void;
}

export function BatchDcaForm({
  fundName,
  existingPurchaseDates,
  onSubmit,
  onBack,
}: BatchDcaFormProps) {
  const today = formatDateISO(new Date());
  const monthAgo = formatDateISO(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  );

  const [startDate, setStartDate] = useState(monthAgo);
  const [endDate, setEndDate] = useState(today);
  const [dailyAmount, setDailyAmount] = useState('20');
  const [fee, setFee] = useState('0');
  const [skipNonTradingDays, setSkipNonTradingDays] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const preview = useMemo(() => {
    if (!startDate || !endDate || startDate > endDate) {
      return { total: 0, newCount: 0, skipCount: 0 };
    }
    const all = enumerateDates(startDate, endDate, skipNonTradingDays);
    const newCount = all.filter((d) => !existingPurchaseDates.has(d)).length;
    return {
      total: all.length,
      newCount,
      skipCount: all.length - newCount,
    };
  }, [startDate, endDate, skipNonTradingDays, existingPurchaseDates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const batch: BatchDcaInput = {
      startDate,
      endDate,
      dailyAmount: parseFloat(dailyAmount) || 0,
      fee: parseFloat(fee) || 0,
      skipNonTradingDays,
    };
    if (batch.dailyAmount <= 0) return;
    setSubmitting(true);
    try {
      await onSubmit(batch);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fund-detail-page">
      <header className="page-header">
        <button className="nav-btn" onClick={onBack} type="button">
          取消
        </button>
        <h1>批量定投</h1>
        <button
          className="nav-btn nav-btn-primary"
          disabled={submitting || preview.newCount === 0}
          form="batch-dca-form"
          type="submit"
        >
          {submitting ? '生成中…' : '生成'}
        </button>
      </header>

      <p className="form-context">{fundName}</p>

      <form id="batch-dca-form" onSubmit={handleSubmit}>
        <FormSection
          title="定投区间"
          footer="将按日期范围逐日生成购入记录，勾选「跳过非交易日」时会排除周末及法定休市日，已存在购入记录的日期会自动跳过"
        >
          <FormRow label="开始日期">
            <input
              className="form-input form-input-date"
              required
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </FormRow>
          <FormRow label="结束日期">
            <input
              className="form-input form-input-date"
              required
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </FormRow>
          <FormRow label="每日金额">
            <input
              className="form-input"
              inputMode="decimal"
              min="0.01"
              required
              step="0.01"
              type="number"
              value={dailyAmount}
              onChange={(e) => setDailyAmount(e.target.value)}
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
          <FormRow label="跳过非交易日">
            <label className="checkbox-label">
              <input
                checked={skipNonTradingDays}
                type="checkbox"
                onChange={(e) => setSkipNonTradingDays(e.target.checked)}
              />
              <span>{skipNonTradingDays ? '是' : '否'}</span>
            </label>
          </FormRow>
        </FormSection>

        <div className="batch-preview">
          <div className="batch-preview-row">
            <span>区间内交易日</span>
            <strong>{preview.total} 天</strong>
          </div>
          <div className="batch-preview-row">
            <span>将新增记录</span>
            <strong>{preview.newCount} 条</strong>
          </div>
          {preview.skipCount > 0 && (
            <div className="batch-preview-row muted">
              <span>跳过已有记录</span>
              <span>{preview.skipCount} 天</span>
            </div>
          )}
          {preview.newCount > 0 && (
            <div className="batch-preview-row">
              <span>合计投入</span>
              <strong>
                ¥
                {(
                  preview.newCount * (parseFloat(dailyAmount) || 0)
                ).toFixed(2)}
              </strong>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
