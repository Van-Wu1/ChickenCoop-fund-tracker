import type { Fund } from '../types';
import {
  formatDateISO,
  formatDisplayDate,
  getFundStats,
} from './calculations';

export interface ExportPayload {
  version: 1;
  exportedAt: string;
  funds: Fund[];
}

function exportFilename(ext: string): string {
  return `农场主的鸡窝-${formatDateISO(new Date())}.${ext}`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportFundsJson(funds: Fund[]): void {
  const payload: ExportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    funds,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  triggerDownload(blob, exportFilename('json'));
}

function recordTypeLabel(tx: Fund['transactions'][number]): string {
  if (tx.amount > 0) return '定投购入';
  if (tx.unitNav !== null) return '收盘更新';
  return '待完善';
}

export async function exportFundsXlsx(funds: Fund[]): Promise<void> {
  const XLSX = await import('xlsx');
  const summaryRows = funds.map((fund) => {
    const stats = getFundStats(fund);
    return {
      基金代码: fund.code,
      基金名称: fund.name,
      板块: fund.sector ?? '',
      持有成本: stats.cost,
      持有市值: stats.marketValue,
      累计收益: stats.profit,
      收益率: stats.profitRate,
      收益日期: stats.profitDate ? formatDisplayDate(stats.profitDate) : '',
      记录数: fund.transactions.filter((t) => t.date).length,
    };
  });

  const transactionRows = funds.flatMap((fund) =>
    fund.transactions
      .filter((t) => t.date)
      .map((tx) => ({
        基金代码: fund.code,
        基金名称: fund.name,
        日期: formatDisplayDate(tx.date),
        类型: recordTypeLabel(tx),
        投入金额: tx.amount,
        确认净值: tx.confirmedNav > 0 ? tx.confirmedNav : '',
        确认份额: tx.confirmedShares > 0 ? tx.confirmedShares : '',
        持有成本: tx.holdingAmount,
        收盘净值: tx.unitNav ?? '',
        持有市值: tx.marketValue ?? '',
        当日收益: tx.dailyProfit ?? '',
        累计收益: tx.cumulativeProfit ?? '',
        手续费: tx.fee,
      })),
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(summaryRows),
    '基金汇总',
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(transactionRows),
    '交易记录',
  );

  XLSX.writeFile(workbook, exportFilename('xlsx'));
}
