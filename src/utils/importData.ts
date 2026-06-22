import type { Fund, NewRecordInput } from '../types';
import {
  compareDate,
  normalizeDateToISO,
  rebuildTransactions,
} from './calculations';
import type { ExportPayload } from './exportData';
import { normalizeFunds } from './storage';

export interface ImportResult {
  funds: Fund[];
}

function excelSerialToISO(serial: number): string {
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial * 86400000);
  const d = new Date(utc);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function cellDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return excelSerialToISO(value);
  }
  return normalizeDateToISO(cellStr(value));
}

function cellStr(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function cellNum(value: unknown): number {
  if (value === '' || value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function cellNullableNum(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseJsonImport(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('JSON 文件格式无效');
  }

  if (Array.isArray(data)) {
    return { funds: normalizeFunds(data as Fund[]) };
  }

  const payload = data as ExportPayload & { watchlist?: unknown };
  if (!payload.funds || !Array.isArray(payload.funds)) {
    throw new Error('JSON 中缺少 funds 字段，请使用本应用导出的格式');
  }

  return { funds: normalizeFunds(payload.funds) };
}

function xlsxRowToInput(row: Record<string, unknown>): NewRecordInput {
  const type = cellStr(row['类型']);
  const amount = cellNum(row['投入金额']);
  const confirmedNav = cellNum(row['确认净值']);
  const fee = cellNum(row['手续费']);
  const unitNav = cellNullableNum(row['收盘净值']);
  const isNavOnly =
    type === '收盘更新' || (amount === 0 && confirmedNav === 0);

  return {
    date: cellDate(row['日期']),
    amount,
    confirmedNav,
    fee,
    unitNav,
    isNavOnly,
  };
}

async function parseXlsxImport(buffer: ArrayBuffer): Promise<ImportResult> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array' });

  const txSheet = workbook.Sheets['交易记录'];
  if (!txSheet) {
    throw new Error('Excel 中缺少「交易记录」工作表，请使用本应用导出的格式');
  }

  const txRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(txSheet);
  const summaryRows = workbook.Sheets['基金汇总']
    ? XLSX.utils.sheet_to_json<Record<string, unknown>>(
        workbook.Sheets['基金汇总'],
      )
    : [];

  const metaByCode = new Map<string, { name: string; sector?: string }>();
  for (const row of summaryRows) {
    const code = cellStr(row['基金代码']);
    if (!code) continue;
    const sector = cellStr(row['板块']);
    metaByCode.set(code, {
      name: cellStr(row['基金名称']) || code,
      sector: sector || undefined,
    });
  }

  const inputsByCode = new Map<string, NewRecordInput[]>();
  for (const row of txRows) {
    const code = cellStr(row['基金代码']);
    if (!code) continue;

    const name = cellStr(row['基金名称']);
    if (name && !metaByCode.has(code)) {
      metaByCode.set(code, { name });
    } else if (name && metaByCode.has(code)) {
      const meta = metaByCode.get(code)!;
      if (!meta.name || meta.name === code) meta.name = name;
    }

    const inputs = inputsByCode.get(code) ?? [];
    inputs.push(xlsxRowToInput(row));
    inputsByCode.set(code, inputs);
  }

  for (const row of summaryRows) {
    const code = cellStr(row['基金代码']);
    if (code && !inputsByCode.has(code)) {
      inputsByCode.set(code, []);
    }
  }

  const funds: Fund[] = [];
  for (const [code, inputs] of inputsByCode) {
    const meta = metaByCode.get(code) ?? { name: code };
    const sorted = [...inputs].sort((a, b) => compareDate(a.date, b.date));
    funds.push({
      id: code,
      code,
      name: meta.name,
      sector: meta.sector,
      transactions: rebuildTransactions(sorted),
    });
  }

  funds.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

  return { funds };
}

export async function importFundsFromFile(file: File): Promise<ImportResult> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.json')) {
    const text = await file.text();
    return parseJsonImport(text);
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    return parseXlsxImport(buffer);
  }

  throw new Error('仅支持 .json 或 .xlsx 文件');
}

export const IMPORT_ACCEPT = '.json,.xlsx,application/json';
