import { useState } from 'react';
import { FormRow, FormSection } from './FormSection';

interface AddFundFormProps {
  onSubmit: (code: string, name: string) => void;
  onBack: () => void;
  initialCode?: string;
  initialName?: string;
}

export function AddFundForm({
  onSubmit,
  onBack,
  initialCode = '',
  initialName = '',
}: AddFundFormProps) {
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState(initialName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(code.trim(), name.trim() || `基金 ${code.trim()}`);
  };

  return (
    <div className="fund-detail-page">
      <header className="page-header">
        <button className="nav-btn" onClick={onBack} type="button">
          取消
        </button>
        <h1>添加基金</h1>
        <button
          className="nav-btn nav-btn-primary"
          form="add-fund-form"
          type="submit"
        >
          保存
        </button>
      </header>

      <form id="add-fund-form" onSubmit={handleSubmit}>
        <FormSection title="基金信息">
          <FormRow label="基金代码">
            <input
              className="form-input"
              placeholder="如 021528"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </FormRow>
          <FormRow label="基金名称">
            <input
              className="form-input"
              placeholder="如 财通成长优选混C"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormRow>
        </FormSection>
      </form>
    </div>
  );
}
