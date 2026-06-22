import type { ReactNode } from 'react';

interface FormSectionProps {
  title?: string;
  footer?: string;
  children: ReactNode;
}

export function FormSection({ title, footer, children }: FormSectionProps) {
  return (
    <section className="form-section">
      {title && <h3 className="form-section-title">{title}</h3>}
      <div className="form-group">{children}</div>
      {footer && <p className="form-section-footer">{footer}</p>}
    </section>
  );
}

interface FormRowProps {
  label: string;
  value?: ReactNode;
  children?: ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  accent?: boolean;
}

export function FormRow({
  label,
  value,
  children,
  chevron,
  onClick,
  accent,
}: FormRowProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={`form-row${onClick ? ' form-row-clickable' : ''}${accent ? ' form-row-accent' : ''}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <span className="form-row-label">{label}</span>
      <span className="form-row-value">
        {children ?? value}
        {chevron && <span className="chevron">›</span>}
      </span>
    </Tag>
  );
}

interface SegmentedControlProps {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}

export function SegmentedControl({
  options,
  value,
  onChange,
}: SegmentedControlProps) {
  return (
    <div className="segmented-control">
      {options.map((opt) => (
        <button
          key={opt.id}
          className={`segment${value === opt.id ? ' active' : ''}`}
          onClick={() => onChange(opt.id)}
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
