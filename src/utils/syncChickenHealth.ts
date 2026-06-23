import type { Fund } from '../types';
import type { TerminalLineType } from '../hooks/useSyncTerminal';
import { getFundStats } from './calculations';

/** 按当日涨跌区分「一点」和「很多」的阈值（1%） */
const BIG_MOVE = 0.01;

export type ChickenTier =
  | 'flat'
  | 'weak'
  | 'dying'
  | 'good'
  | 'great';

export interface ChickenHealth {
  label: string;
  type: TerminalLineType;
  tier: ChickenTier;
}

const LABELS: Record<ChickenTier, string> = {
  flat: '今天没啥动静',
  weak: '营养不良，得补补',
  dying: '要死了，赶紧加餐！',
  good: '长了一点肉，吃得不错',
  great: '膘肥体壮，精神极好！',
};

const TYPES: Record<ChickenTier, TerminalLineType> = {
  flat: 'dim',
  weak: 'error',
  dying: 'error',
  good: 'success',
  great: 'success',
};

export function getChickenTier(fund: Fund): ChickenTier {
  const { dailyProfit, dailyChange } = getFundStats(fund);
  const pct = dailyChange;

  if (dailyProfit === 0 && (pct === null || pct === 0)) {
    return 'flat';
  }

  const isLoss = dailyProfit < 0 || (pct !== null && pct < 0);
  const isGain = dailyProfit > 0 || (pct !== null && pct > 0);

  if (isLoss) {
    const bigLoss =
      (pct !== null && pct <= -BIG_MOVE) ||
      (pct === null && dailyProfit <= -5);
    return bigLoss ? 'dying' : 'weak';
  }

  if (isGain) {
    const bigGain =
      (pct !== null && pct >= BIG_MOVE) ||
      (pct === null && dailyProfit >= 5);
    return bigGain ? 'great' : 'good';
  }

  return 'flat';
}

export function getChickenHealth(fund: Fund): ChickenHealth {
  const tier = getChickenTier(fund);
  return { label: LABELS[tier], type: TYPES[tier], tier };
}

export function logChickenHealth(
  log: (text: string, type?: TerminalLineType) => void,
  fund: Fund,
  result: { success: boolean; message: string },
  indent = '',
): void {
  if (!result.success) {
    log(`${indent}✗ 这只小鸡不太对劲 · ${result.message}`, 'error');
    return;
  }

  const health = getChickenHealth(fund);
  log(`${indent}✓ ${health.label} · ${result.message}`, health.type);
}
