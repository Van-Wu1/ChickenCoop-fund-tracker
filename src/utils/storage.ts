import { localFunds as seedFunds } from '@app-seed-funds';
import type { Fund } from '../types';
import {
  normalizeDateToISO,
  rebuildTransactions,
  transactionToInput,
} from './calculations';

const STORAGE_KEY = 'fund-tracker-data';

export function normalizeFund(fund: Fund): Fund {
  return migrateFund(fund);
}

export function normalizeFunds(funds: Fund[]): Fund[] {
  return funds.map(migrateFund);
}

function migrateFund(fund: Fund): Fund {
  const inputs = fund.transactions
    .filter((t) => t.date)
    .map((t) => {
      const date = normalizeDateToISO(t.date);
      return { ...transactionToInput({ ...t, date }), date };
    });
  return { ...fund, transactions: rebuildTransactions(inputs) };
}

function getSeedFunds(): Fund[] {
  return structuredClone(seedFunds).map(migrateFund);
}

export function loadFunds(): Fund[] {
  const seed = getSeedFunds();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = (JSON.parse(raw) as Fund[]).map(migrateFund);
      if (saved.length > 0 || seed.length === 0) {
        return saved;
      }
    }
  } catch {
    // fall through to seed data
  }

  return seed;
}

export function saveFunds(funds: Fund[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(funds));
}

export function resetFunds(): Fund[] {
  localStorage.removeItem(STORAGE_KEY);
  return getSeedFunds();
}
