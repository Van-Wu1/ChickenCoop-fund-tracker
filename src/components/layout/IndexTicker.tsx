import type { MarketIndex } from '../../types';
import { formatMoney, profitColor } from '../../utils/calculations';

interface IndexTickerProps {
  indices: MarketIndex[];
}

export function IndexTicker({ indices }: IndexTickerProps) {
  if (indices.length === 0) return null;

  return (
    <footer className="index-bar">
      {indices.map((idx) => {
        const up = idx.change >= 0;
        return (
          <span key={idx.code} className="index-bar-item">
            <span className="index-bar-name">{idx.name}</span>
            <span className="index-bar-price">{idx.price.toFixed(2)}</span>
            <span style={{ color: profitColor(idx.changePct) }}>
              {up ? '+' : ''}
              {formatMoney(idx.change, 2)} ({up ? '+' : ''}
              {idx.changePct.toFixed(2)}%)
            </span>
          </span>
        );
      })}
    </footer>
  );
}
