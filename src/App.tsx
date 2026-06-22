import { useCallback, useEffect, useRef, useState } from 'react';
import { AddFundForm, AddRecordForm } from './components/AddRecordForm';
import { BatchDcaForm } from './components/BatchDcaForm';
import { FundDetail } from './components/FundDetail';
import { RecordForm } from './components/RecordForm';
import { HoldingsPage } from './components/HoldingsPage';
import { MarketPage } from './components/MarketPage';
import { SettingsPage } from './components/SettingsPage';
import { SearchPage } from './components/SearchPage';
import { SideNav } from './components/layout/SideNav';
import { IndexTicker } from './components/layout/IndexTicker';
import { TopHeader } from './components/layout/TopHeader';
import type {
  BatchDcaInput,
  Fund,
  FundSearchResult,
  MarketIndex,
  NewRecordInput,
  Overlay,
  Tab,
  Transaction,
} from './types';
import {
  addRecordToFund,
  appendBatchDcaToFund,
  buildBatchDcaInputs,
  deleteFundTransaction,
  formatDisplayDate,
  getPurchaseDates,
  updateFundTransaction,
} from './utils/calculations';
import { loadFunds, resetFunds, saveFunds } from './utils/storage';
import { syncFundComplete, type SyncResult } from './utils/applyNavUpdate';
import { fetchNavMapForRange } from './utils/fundApi';
import { getNavForDate } from './utils/backfillNav';
import { fetchMarketIndices } from './utils/marketApi';
import type { ImportResult } from './utils/importData';
import { useSyncTerminal } from './hooks/useSyncTerminal';
import './App.css';

function App() {
  const [funds, setFunds] = useState<Fund[]>(() => loadFunds());
  const fundsRef = useRef(funds);
  fundsRef.current = funds;
  const [tab, setTab] = useState<Tab>('holdings');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [selectedFundId, setSelectedFundId] = useState<string | null>(null);
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [prefillFund, setPrefillFund] = useState<{
    code: string;
    name: string;
  } | null>(null);
  const [editingRecord, setEditingRecord] = useState<Transaction | null>(null);
  const { lines: terminalLines, log: terminalLog } = useSyncTerminal();

  useEffect(() => {
    saveFunds(funds);
  }, [funds]);

  useEffect(() => {
    fetchMarketIndices().then(setIndices).catch(() => undefined);
    const timer = window.setInterval(() => {
      fetchMarketIndices().then(setIndices).catch(() => undefined);
    }, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedFund = funds.find((f) => f.id === selectedFundId) ?? null;
  const holdingCodes = funds.map((f) => f.code);

  const handleAddFund = useCallback((code: string, name: string, sector?: string) => {
    const id = code;
    if (funds.some((f) => f.id === id)) {
      setSelectedFundId(id);
      setOverlay('fund-detail');
      return;
    }
    setFunds((prev) => [
      ...prev,
      { id, code, name, sector, transactions: [] },
    ]);
    setSelectedFundId(id);
    setOverlay('fund-detail');
  }, [funds]);

  const openFund = useCallback(
    (code: string, name?: string, sector?: string) => {
      const existing = funds.find((f) => f.code === code);
      if (existing) {
        setSelectedFundId(existing.id);
        setOverlay('fund-detail');
        return;
      }
      if (name) {
        handleAddFund(code, name, sector);
        return;
      }
      setPrefillFund({ code, name: '' });
      setOverlay('add-fund');
    },
    [funds, handleAddFund],
  );

  const handleAddRecord = useCallback(
    (input: NewRecordInput) => {
      if (!selectedFundId) return;
      setFunds((prev) =>
        prev.map((f) =>
          f.id === selectedFundId ? addRecordToFund(f, input) : f,
        ),
      );
      setOverlay('fund-detail');
    },
    [selectedFundId],
  );

  const handleUpdateRecord = useCallback(
    (input: NewRecordInput) => {
      if (!selectedFundId || !editingRecord) return;
      setFunds((prev) =>
        prev.map((f) =>
          f.id === selectedFundId
            ? updateFundTransaction(f, editingRecord.id, input)
            : f,
        ),
      );
      setEditingRecord(null);
      setOverlay('fund-detail');
    },
    [selectedFundId, editingRecord],
  );

  const handleDeleteRecord = useCallback(() => {
    if (!selectedFundId || !editingRecord) return;
    if (!confirm('确定删除这条交易记录？删除后将重新计算后续持仓。')) return;
    setFunds((prev) =>
      prev.map((f) =>
        f.id === selectedFundId
          ? deleteFundTransaction(f, editingRecord.id)
          : f,
      ),
    );
    setEditingRecord(null);
    setOverlay('fund-detail');
  }, [selectedFundId, editingRecord]);

  const handleDeleteRecordById = useCallback(
    (tx: Transaction) => {
      if (!selectedFundId) return;
      if (!confirm(`确定删除 ${formatDisplayDate(tx.date)} 的这条记录？删除后将重新计算后续持仓。`)) {
        return;
      }
      setFunds((prev) =>
        prev.map((f) =>
          f.id === selectedFundId ? deleteFundTransaction(f, tx.id) : f,
        ),
      );
    },
    [selectedFundId],
  );

  const handleBatchDca = useCallback(
    async (batch: BatchDcaInput) => {
      if (!selectedFundId) return;
      const fund = funds.find((f) => f.id === selectedFundId);
      if (!fund) return;

      const navMap = await fetchNavMapForRange(
        fund.code,
        batch.startDate,
        batch.endDate,
      );
      const newInputs = buildBatchDcaInputs(
        batch,
        navMap,
        getPurchaseDates(fund),
      ).map((input) => {
        const nav = getNavForDate(navMap, input.date);
        if (nav && input.confirmedNav <= 0) {
          return {
            ...input,
            confirmedNav: nav.unitNav,
          };
        }
        return input;
      });
      if (newInputs.length === 0) {
        alert('所选区间内没有可新增的定投日期');
        return;
      }

      const tempFund = appendBatchDcaToFund(fund, newInputs);
      const { fund: synced } = await syncFundComplete(tempFund);
      setFunds((prev) =>
        prev.map((f) => (f.id === selectedFundId ? synced : f)),
      );
      setOverlay('fund-detail');
    },
    [selectedFundId, funds],
  );

  const handleAddFromSearch = useCallback(
    (item: FundSearchResult) => {
      handleAddFund(item.code, item.name, item.sector);
    },
    [handleAddFund],
  );

  const handleReset = useCallback(() => {
    if (confirm('确定重置为 Excel 中的初始数据？当前修改将丢失。')) {
      setFunds(resetFunds());
      setTab('holdings');
      setOverlay(null);
      setSelectedFundId(null);
    }
  }, []);

  const handleImport = useCallback((data: ImportResult): boolean => {
    const msg = `将导入 ${data.funds.length} 只基金，并替换当前全部数据。\n\n确定继续吗？`;
    if (!confirm(msg)) return false;

    setFunds(data.funds);
    setSelectedFundId(null);
    setEditingRecord(null);
    setOverlay(null);
    setTab('holdings');
    return true;
  }, []);

  const handleDeleteFund = useCallback(
    (id: string) => {
      const fund = funds.find((f) => f.id === id);
      if (!fund) return;
      if (
        !confirm(
          `确定删除「${fund.name}」？\n\n该基金的所有交易记录将被永久删除，此操作不可恢复。`,
        )
      ) {
        return;
      }
      setFunds((prev) => prev.filter((f) => f.id !== id));
      if (selectedFundId === id) {
        setSelectedFundId(null);
        setOverlay(null);
        setEditingRecord(null);
      }
    },
    [funds, selectedFundId],
  );

  const handleSyncFund = useCallback(
    async (code: string): Promise<SyncResult> => {
      const fund = fundsRef.current.find((f) => f.code === code);
      if (!fund) throw new Error('基金不存在');

      terminalLog('正在为老乡检查小鸡们的健康状况…', 'prompt');
      terminalLog(`  看看 ${fund.name} 这只小鸡…`, 'dim');

      try {
        const { fund: updated, result } = await syncFundComplete(fund);
        setFunds((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
        terminalLog(
          result.success ? `  ✓ 精神不错 · ${result.message}` : `  ✗ 有点蔫 · ${result.message}`,
          result.success ? 'success' : 'error',
        );
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : '同步失败';
        terminalLog(`  ✗ 这只小鸡不太对劲 · ${message}`, 'error');
        throw err;
      }
    },
    [terminalLog],
  );

  const handleSyncAll = useCallback(async (): Promise<SyncResult[]> => {
    const list = fundsRef.current;
    terminalLog('正在为老乡检查小鸡们的健康状况…', 'prompt');
    terminalLog(`共 ${list.length} 只小鸡待体检`, 'dim');

    const results: SyncResult[] = [];
    const updatedById = new Map<string, Fund>();

    for (const fund of list) {
      terminalLog(`  看看 ${fund.name}…`, 'dim');
      try {
        const { fund: updated, result } = await syncFundComplete(fund);
        updatedById.set(updated.id, updated);
        results.push(result);
        terminalLog(
          result.success ? `    ✓ 状态良好 · ${result.message}` : `    ✗ 有点蔫 · ${result.message}`,
          result.success ? 'success' : 'error',
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : '同步失败';
        results.push({
          code: fund.code,
          name: fund.name,
          success: false,
          message,
        });
        terminalLog(`    ✗ 不太对劲 · ${message}`, 'error');
      }
    }

    if (updatedById.size > 0) {
      setFunds((prev) =>
        prev.map((f) => updatedById.get(f.id) ?? f),
      );
    }

    const ok = results.filter((r) => r.success).length;
    terminalLog(
      `体检完毕，${ok}/${results.length} 只小鸡都挺精神 🐣`,
      ok === results.length ? 'success' : ok > 0 ? 'info' : 'error',
    );

    return results;
  }, [terminalLog]);

  const closeOverlay = () => {
    setOverlay(null);
    setEditingRecord(null);
    if (overlay === 'fund-detail' || overlay === 'add-record') {
      setSelectedFundId(null);
    }
  };

  return (
    <div className="app-shell">
      {!overlay && (
        <TopHeader onSearch={() => setOverlay('search')} />
      )}

      <div className="app-body">
        {!overlay && (
          <SideNav
            active={tab}
            onChange={setTab}
            terminalLines={terminalLines}
          />
        )}

        <div className="app-main">
          <div className="main-body">
          {!overlay && tab === 'holdings' && (
            <HoldingsPage
              funds={funds}
              onAddFund={() => setOverlay('add-fund')}
              onDeleteFund={handleDeleteFund}
              onSelectFund={(id) => {
                setSelectedFundId(id);
                setOverlay('fund-detail');
              }}
              onSyncAll={handleSyncAll}
            />
          )}
          {!overlay && tab === 'market' && <MarketPage />}
          {!overlay && tab === 'settings' && (
            <SettingsPage
              funds={funds}
              onImport={handleImport}
              onReset={handleReset}
              onSyncAll={handleSyncAll}
            />
          )}

          {overlay === 'search' && (
            <SearchPage
              holdingCodes={holdingCodes}
              onAddHolding={handleAddFromSearch}
              onClose={closeOverlay}
              onOpenFund={openFund}
            />
          )}

          {overlay === 'fund-detail' && selectedFund && (
            <FundDetail
              fund={selectedFund}
              onAddRecord={() => setOverlay('add-record')}
              onBack={closeOverlay}
              onBatchDca={() => setOverlay('batch-dca')}
              onDeleteFund={() => handleDeleteFund(selectedFund.id)}
              onDeleteRecord={handleDeleteRecordById}
              onEditRecord={(tx) => {
                setEditingRecord(tx);
                setOverlay('edit-record');
              }}
              onSync={handleSyncFund}
            />
          )}

          {overlay === 'add-record' && selectedFund && (
            <AddRecordForm
              fundName={selectedFund.name}
              onBack={() => setOverlay('fund-detail')}
              onSubmit={handleAddRecord}
            />
          )}

          {overlay === 'edit-record' && selectedFund && editingRecord && (
            <RecordForm
              fundName={selectedFund.name}
              initial={editingRecord}
              title="编辑记录"
              onBack={() => {
                setEditingRecord(null);
                setOverlay('fund-detail');
              }}
              onDelete={handleDeleteRecord}
              onSubmit={handleUpdateRecord}
            />
          )}

          {overlay === 'batch-dca' && selectedFund && (
            <BatchDcaForm
              existingPurchaseDates={getPurchaseDates(selectedFund)}
              fundName={selectedFund.name}
              onBack={() => setOverlay('fund-detail')}
              onSubmit={handleBatchDca}
            />
          )}

          {overlay === 'add-fund' && (
            <AddFundForm
              initialCode={prefillFund?.code}
              initialName={prefillFund?.name}
              onBack={() => {
                setPrefillFund(null);
                closeOverlay();
              }}
              onSubmit={(code, name) => {
                handleAddFund(code, name);
                setPrefillFund(null);
              }}
            />
          )}
        </div>

        {!overlay && <IndexTicker indices={indices} />}
      </div>
      </div>
    </div>
  );
}

export default App;
