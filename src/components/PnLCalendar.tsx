import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Fund } from '../types';
import { formatMoney, profitColor } from '../utils/calculations';
import {
  buildYearCalendarGrid,
  getAvailableYears,
  getMonthLabelPositions,
  getPortfolioDailyProfits,
  getProfitLevel,
  getWeekColumnForDate,
  findBestMonth,
} from '../utils/portfolioDailyProfit';

const PNL_CELL = 18;
const PNL_GAP = 4;
const PNL_DAY_COL = 30;

const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_LABELS = [
  '1月',
  '2月',
  '3月',
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月',
];

interface PnLCalendarProps {
  funds: Fund[];
}

export function PnLCalendar({ funds }: PnLCalendarProps) {
  const profitMap = useMemo(() => getPortfolioDailyProfits(funds), [funds]);
  const years = useMemo(() => getAvailableYears(funds), [funds]);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(() =>
    years.includes(currentYear) ? currentYear : (years[0] ?? currentYear),
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    date: string;
    profit: number;
  } | null>(null);

  const grid = useMemo(
    () => buildYearCalendarGrid(profitMap, year),
    [profitMap, year],
  );
  const monthLabels = useMemo(() => getMonthLabelPositions(year), [year]);
  const bestMonth = useMemo(
    () => findBestMonth(profitMap, year),
    [profitMap, year],
  );

  const todayIso = new Date().toISOString().slice(0, 10);

  useLayoutEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || year !== currentYear) return;

    const weekCol = getWeekColumnForDate(year);
    const weekWidth = PNL_CELL + PNL_GAP;
    const todayLeft = PNL_DAY_COL + PNL_GAP + weekCol * weekWidth;
    const target =
      todayLeft - scrollEl.clientWidth * 0.55 + PNL_CELL / 2;

    scrollEl.scrollLeft = Math.max(
      0,
      Math.min(target, scrollEl.scrollWidth - scrollEl.clientWidth),
    );
  }, [year, grid.weekCount, currentYear]);

  return (
    <div className="pnl-calendar">
      <div className="pnl-calendar-head">
        <div className="pnl-calendar-title-wrap">
          <span className="pnl-calendar-accent" aria-hidden />
          <h2 className="pnl-calendar-title">盈亏日历</h2>
        </div>
        <select
          className="pnl-calendar-year"
          onChange={(e) => setYear(Number(e.target.value))}
          value={year}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y} 年
            </option>
          ))}
        </select>
      </div>

      <div className="pnl-calendar-main">
        <div ref={scrollRef} className="pnl-calendar-scroll">
          <div
            className="pnl-calendar-grid-wrap"
            style={{ '--pnl-weeks': grid.weekCount } as CSSProperties}
          >
            <div className="pnl-calendar-months" aria-hidden>
              <span className="pnl-calendar-month-spacer" />
              {Array.from({ length: grid.weekCount }, (_, col) => {
                const label = monthLabels.find((m) => m.col === col);
                return (
                  <span key={col} className="pnl-calendar-month">
                    {label ? MONTH_LABELS[label.month - 1] : ''}
                  </span>
                );
              })}
            </div>

            <div className="pnl-calendar-grid-inner">
            <div className="pnl-calendar-days" aria-hidden>
              {DAY_LABELS.map((label, i) => (
                <span
                  key={label}
                  className={`pnl-calendar-day-label${i % 2 === 0 ? '' : ' muted'}`}
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="pnl-calendar-cells">
              {grid.rows.map((row, rowIdx) =>
                row.map((cell, colIdx) => {
                  if (!cell.date) {
                    return (
                      <span
                        key={`${rowIdx}-${colIdx}`}
                        className="pnl-cell pnl-cell-outside"
                      />
                    );
                  }

                  const level =
                    cell.profit !== null
                      ? getProfitLevel(cell.profit, grid.maxAbs)
                      : 0;
                  const sign =
                    cell.profit !== null && cell.profit !== 0
                      ? cell.profit > 0
                        ? 'profit'
                        : 'loss'
                      : 'empty';
                  const isToday = cell.date === todayIso;

                  return (
                    <span
                      key={cell.date}
                      className={[
                        'pnl-cell',
                        `pnl-cell-${sign}`,
                        level > 0 ? `pnl-cell-l${level}` : '',
                        isToday ? 'pnl-cell-today' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onBlur={() => setTooltip(null)}
                      onFocus={(e) => {
                        if (cell.profit === null) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                          date: cell.date!,
                          profit: cell.profit,
                        });
                      }}
                      onMouseEnter={(e) => {
                        if (cell.profit === null) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                          date: cell.date!,
                          profit: cell.profit,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      role="gridcell"
                      tabIndex={cell.profit !== null ? 0 : -1}
                      title={
                        cell.profit !== null
                          ? `${cell.date}: ${cell.profit >= 0 ? '+' : ''}${formatMoney(cell.profit)}`
                          : cell.date
                      }
                    />
                  );
                }),
              )}
            </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pnl-calendar-meta">
        <div className="pnl-calendar-foot">
          <span style={{ color: profitColor(grid.yearTotal) }}>
            {year} 年累计：
            {grid.yearTotal >= 0 ? '+' : ''}
            {formatMoney(grid.yearTotal)}
          </span>
          {bestMonth && (
            <span className="pnl-calendar-foot-muted">
              最佳 {bestMonth.month} 月
              <span style={{ color: profitColor(bestMonth.total) }}>
                {bestMonth.total >= 0 ? '+' : ''}
                {formatMoney(bestMonth.total)}
              </span>
            </span>
          )}
          <span className="pnl-calendar-foot-muted">{grid.activeDays} 天</span>
        </div>

        <div className="pnl-calendar-legend" aria-hidden>
        <span className="pnl-legend-label">亏</span>
        <span className="pnl-cell pnl-cell-loss pnl-cell-l1" />
        <span className="pnl-cell pnl-cell-loss pnl-cell-l2" />
        <span className="pnl-cell pnl-cell-loss pnl-cell-l3" />
        <span className="pnl-cell pnl-cell-loss pnl-cell-l4" />
        <span className="pnl-cell pnl-cell-empty" />
        <span className="pnl-cell pnl-cell-profit pnl-cell-l1" />
        <span className="pnl-cell pnl-cell-profit pnl-cell-l2" />
        <span className="pnl-cell pnl-cell-profit pnl-cell-l3" />
        <span className="pnl-cell pnl-cell-profit pnl-cell-l4" />
        <span className="pnl-legend-label">盈</span>
        </div>
      </div>

      {tooltip && (
        <div
          className="pnl-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="pnl-tooltip-date">{tooltip.date}</div>
          <div
            className="pnl-tooltip-value"
            style={{ color: profitColor(tooltip.profit) }}
          >
            {tooltip.profit >= 0 ? '+' : ''}
            {formatMoney(tooltip.profit)}
          </div>
        </div>
      )}
    </div>
  );
}
