import { useMemo, useState } from 'react';
import { FormRow, FormSection, SegmentedControl } from './FormSection';
import type { NewRecordInput, Transaction } from '../types';
import { normalizeDateToISO, transactionToInput } from '../utils/calculations';

interface RecordFormProps {
  fundName: string;
  title: string;
  submitLabel?: string;
  initial?: Transaction;
  onSubmit: (input: NewRecordInput) => void;
  onBack: () => void;
  onDelete?: () => void;
}

export function RecordForm({
  fundName,
  title,
  submitLabel = '保存',
  initial,
  onSubmit,
  onBack,
  onDelete,
}: RecordFormProps) {
  const defaults = useMemo(
    () => (initial ? transactionToInput(initial) : null),
    [initial],
  );

  const [mode, setMode] = useState<'buy' | 'nav'>(() =>
    defaults?.isNavOnly ? 'nav' : 'buy',
  );
  const [date, setDate] = useState(() =>
    defaults?.date ? normalizeDateToISO(defaults.date) : '',
  );
  const [amount, setAmount] = useState(() =>
    defaults?.amount ? String(defaults.amount) : '',
  );
  const [confirmedNav, setConfirmedNav] = useState(() =>
    defaults?.confirmedNav ? String(defaults.confirmedNav) : '',
  );
  const [fee, setFee] = useState(() =>
    defaults?.fee !== undefined ? String(defaults.fee) : '0',
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      date,
      amount: mode === 'buy' ? parseFloat(amount) || 0 : 0,
      confirmedNav: mode === 'buy' ? parseFloat(confirmedNav) || 0 : 0,
      fee: parseFloat(fee) || 0,
      unitNav: null,
      isNavOnly: mode === 'nav',
    });
  };

  const formId = 'record-form';

  return (
    <div className="fund-detail-page">
      <header className="page-header">
        <button className="nav-btn" onClick={onBack} type="button">
          取消
        </button>
        <h1>{title}</h1>
        <button
          className="nav-btn nav-btn-primary"
          form={formId}
          type="submit"
        >
          {submitLabel}
        </button>
      </header>

      <p className="form-context">{fundName}</p>

      <div className="segment-wrapper">
        <SegmentedControl
          options={[
            { id: 'buy', label: '定投购入' },
            { id: 'nav', label: '收盘更新' },
          ]}
          value={mode}
          onChange={(id) => setMode(id as 'buy' | 'nav')}
        />
      </div>

      <form id={formId} onSubmit={handleSubmit}>
        <FormSection title="基本信息">
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

        {mode === 'buy' && (
          <FormSection title="定投购入" footer="确认份额 = 成交金额 ÷ 确认净值">
            <FormRow label="成交金额">
              <input
                className="form-input"
                inputMode="decimal"
                placeholder="0.00"
                required
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </FormRow>
            <FormRow label="确认净值">
              <input
                className="form-input"
                inputMode="decimal"
                placeholder="0.0000"
                required
                type="number"
                step="0.0001"
                value={confirmedNav}
                onChange={(e) => setConfirmedNav(e.target.value)}
              />
            </FormRow>
            <FormRow label="手续费">
              <input
                className="form-input"
                inputMode="decimal"
                placeholder="0.00"
                type="number"
                step="0.01"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            </FormRow>
          </FormSection>
        )}

        <p className="form-hint">
          收盘净值由「同步净值」自动从天天基金拉取，无需手填。
        </p>

        {onDelete && (
          <div className="form-danger-zone">
            <button className="danger-btn" onClick={onDelete} type="button">
              删除此条记录
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
