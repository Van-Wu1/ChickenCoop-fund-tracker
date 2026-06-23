import type { ConvertFundInput, Fund, NewRecordInput, SellClearInput } from '../types';
import {
  addRecordToFund,
  getFundStats,
  isFundClosed,
  normalizeDateToISO,
} from './calculations';
import { fetchNavMapForRange } from './fundApi';

function buildSellInput(
  fund: Fund,
  input: SellClearInput,
): NewRecordInput {
  const stats = getFundStats(fund);
  const nav = input.unitNav;
  const shares = stats.holdingShares;
  const redemptionAmount =
    input.redemptionAmount ?? (shares > 0 ? shares * nav : 0);

  return {
    date: normalizeDateToISO(input.date),
    amount: 0,
    confirmedNav: nav,
    fee: input.fee ?? 0,
    unitNav: nav,
    isNavOnly: false,
    recordKind: 'sell',
    sellShares: shares,
    redemptionAmount,
  };
}

export function sellClearFund(fund: Fund, input: SellClearInput): Fund {
  if (isFundClosed(fund)) {
    throw new Error('该基金已清仓');
  }

  const stats = getFundStats(fund);
  if (stats.holdingShares <= 0) {
    throw new Error('当前没有可卖出的份额');
  }

  const updated = addRecordToFund(fund, buildSellInput(fund, input));
  return { ...updated, status: 'closed' };
}

export function convertFund(
  allFunds: Fund[],
  source: Fund,
  input: ConvertFundInput,
): { funds: Fund[]; targetFundId: string } {
  if (isFundClosed(source)) {
    throw new Error('源基金已清仓，无法转化');
  }

  const stats = getFundStats(source);
  if (stats.holdingShares <= 0) {
    throw new Error('源基金没有可转化的份额');
  }

  if (source.code === input.targetCode.trim()) {
    throw new Error('不能转化为同一只基金');
  }

  const redemptionAmount =
    input.redemptionAmount ??
    stats.holdingShares * input.sourceUnitNav;
  const netBuyAmount = Math.max(
    0,
    redemptionAmount - (input.sourceFee ?? 0) - (input.targetFee ?? 0),
  );

  const sourceUpdated = sellClearFund(source, {
    date: input.date,
    unitNav: input.sourceUnitNav,
    fee: input.sourceFee ?? 0,
    redemptionAmount,
  });

  const buyInput: NewRecordInput = {
    date: normalizeDateToISO(input.date),
    amount: netBuyAmount,
    confirmedNav: input.targetConfirmedNav,
    fee: input.targetFee ?? 0,
    unitNav: null,
    isNavOnly: false,
    recordKind: 'buy',
  };

  const targetCode = input.targetCode.trim();
  const existingTarget = allFunds.find((f) => f.code === targetCode);
  let funds = allFunds.map((f) => (f.id === source.id ? sourceUpdated : f));
  let targetFundId: string;

  if (existingTarget) {
    if (isFundClosed(existingTarget)) {
      throw new Error('目标基金已清仓，请先在持有列表中查看或新建持有');
    }
    funds = funds.map((f) =>
      f.code === targetCode ? addRecordToFund(f, buyInput) : f,
    );
    targetFundId = existingTarget.id;
  } else {
    const newFund: Fund = {
      id: targetCode,
      code: targetCode,
      name: input.targetName.trim() || `基金 ${targetCode}`,
      sector: input.targetSector,
      status: 'holding',
      transactions: [],
    };
    funds = [...funds, addRecordToFund(newFund, buyInput)];
    targetFundId = targetCode;
  }

  return { funds, targetFundId };
}

export async function fetchNavOnDate(
  code: string,
  date: string,
): Promise<number | null> {
  const map = await fetchNavMapForRange(code, date, date);
  const item = map.get(date) ?? [...map.values()][0];
  return item?.unitNav ?? null;
}
