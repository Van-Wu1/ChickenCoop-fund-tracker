export interface Transaction {
  id: string;
  date: string;
  confirmedShares: number;
  confirmedNav: number;
  amount: number;
  fee: number;
  holdingShares: number;
  holdingAmount: number;
  unitNav: number | null;
  dailyChange: number | null;
  marketValue: number | null;
  dailyProfit: number | null;
  cumulativeProfit: number | null;
}

export interface Fund {
  id: string;
  code: string;
  name: string;
  sector?: string;
  transactions: Transaction[];
}

export interface PortfolioStats {
  totalCost: number;
  totalMarketValue: number;
  totalProfit: number;
  totalDailyProfit: number;
}

export type Tab = 'holdings' | 'market' | 'settings';

export type Overlay =
  | null
  | 'search'
  | 'fund-detail'
  | 'add-record'
  | 'edit-record'
  | 'batch-dca'
  | 'add-fund';

export interface BatchDcaInput {
  startDate: string;
  endDate: string;
  dailyAmount: number;
  fee: number;
  skipNonTradingDays: boolean;
}

export interface NavHistoryItem {
  date: string;
  unitNav: number;
  accumulatedNav: number;
  dailyChange: number | null;
}

export interface NewRecordInput {
  date: string;
  amount: number;
  confirmedNav: number;
  fee: number;
  unitNav: number | null;
  isNavOnly: boolean;
}

export interface FundNavQuote {
  code: string;
  name: string;
  navDate: string;
  unitNav: number;
  dailyChange: number | null;
  estimateNav: number | null;
  estimateChange: number | null;
  estimateTime: string | null;
  source: 'official' | 'estimate';
  sector?: string;
}

export interface FundSearchResult {
  code: string;
  name: string;
  sector?: string;
  fundType?: string;
  company?: string;
  unitNav?: number;
  navDate?: string;
}

export interface HotFundItem {
  rank: number;
  code: string;
  name: string;
  sector?: string;
  dailyChange?: number;
}

export interface MarketIndex {
  code: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
}

export interface SectorItem {
  name: string;
  fundCount: number;
  changePct: number;
  streak?: string;
}
