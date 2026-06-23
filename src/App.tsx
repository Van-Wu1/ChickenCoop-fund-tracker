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
  ConvertFundInput,
  Fund,
  FundSearchResult,
  MarketIndex,
  NewRecordInput,
  Overlay,
  SellClearInput,
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
import { getExactNavForDate, getNavForDate } from './utils/backfillNav';
import { fetchMarketIndices } from './utils/marketApi';
import type { ImportResult } from './utils/importData';
import { logChickenHealth, getChickenTier } from './utils/syncChickenHealth';
import { convertFund, sellClearFund } from './utils/fundOperations';
import { useSyncTerminal } from './hooks/useSyncTerminal';
import { ConvertForm } from './components/ConvertForm';
import { SellClearForm } from './components/SellClearForm';
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
    async (input: NewRecordInput) => {
      if (!selectedFundId) return;
      const fund = fundsRef.current.find((f) => f.id === selectedFundId);
      if (!fund) return;

      const withRecord = addRecordToFund(fund, input);
      try {
        const { fund: synced } = await syncFundComplete(withRecord);
        setFunds((prev) =>
          prev.map((f) => (f.id === selectedFundId ? synced : f)),
        );
      } catch {
        setFunds((prev) =>
          prev.map((f) => (f.id === selectedFundId ? withRecord : f)),
        );
      }
      setOverlay('fund-detail');
    },
    [selectedFundId],
  );

  const handleUpdateRecord = useCallback(
    async (input: NewRecordInput) => {
      if (!selectedFundId || !editingRecord) return;
      const fund = fundsRef.current.find((f) => f.id === selectedFundId);
      if (!fund) return;

      const withRecord = updateFundTransaction(fund, editingRecord.id, input);
      try {
        const { fund: synced } = await syncFundComplete(withRecord);
        setFunds((prev) =>
          prev.map((f) => (f.id === selectedFundId ? synced : f)),
        );
      } catch {
        setFunds((prev) =>
          prev.map((f) => (f.id === selectedFundId ? withRecord : f)),
        );
      }
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
        const nav =
          getExactNavForDate(navMap, input.date) ??
          getNavForDate(navMap, input.date);
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

  const handleSellClear = useCallback(
    (input: SellClearInput) => {
      if (!selectedFundId) return;
      try {
        setFunds((prev) =>
          prev.map((f) =>
            f.id === selectedFundId ? sellClearFund(f, input) : f,
          ),
        );
        setOverlay('fund-detail');
      } catch (err) {
        alert(err instanceof Error ? err.message : '清仓失败');
      }
    },
    [selectedFundId],
  );

  const handleConvert = useCallback(
    async (input: ConvertFundInput) => {
      if (!selectedFundId) return;
      const source = funds.find((f) => f.id === selectedFundId);
      if (!source) return;

      const { funds: nextFunds, targetFundId } = convertFund(
        funds,
        source,
        input,
      );
      setFunds(nextFunds);
      setSelectedFundId(targetFundId);
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

  const handleReset = useCallback(async () => {
    if (!confirm('确定重置为 Excel 中的初始数据？当前修改将丢失。')) return;

    const seed = resetFunds();
    setFunds(seed);
    setTab('holdings');
    setOverlay(null);
    setSelectedFundId(null);

    terminalLog('已重置，正在同步官方净值…', 'prompt');
    const syncedById = new Map<string, Fund>();
    for (const fund of seed) {
      try {
        const { fund: synced } = await syncFundComplete(fund);
        syncedById.set(synced.id, synced);
      } catch (err) {
        const message = err instanceof Error ? err.message : '同步失败';
        terminalLog(`  ✗ ${fund.name} · ${message}`, 'error');
        syncedById.set(fund.id, fund);
      }
    }
    if (syncedById.size > 0) {
      setFunds((prev) => prev.map((f) => syncedById.get(f.id) ?? f));
    }
    terminalLog('净值同步完毕', 'success');
  }, [terminalLog]);

  const handleImport = useCallback(
    async (data: ImportResult): Promise<boolean> => {
      const msg = `将导入 ${data.funds.length} 只基金，并替换当前全部数据。\n\n导入后会自动同步官方净值，确定继续吗？`;
      if (!confirm(msg)) return false;

      setFunds(data.funds);
      setSelectedFundId(null);
      setEditingRecord(null);
      setOverlay(null);
      setTab('holdings');

      terminalLog('导入完成，正在同步官方净值…', 'prompt');
      const syncedById = new Map<string, Fund>();
      for (const fund of data.funds) {
        try {
          const { fund: synced } = await syncFundComplete(fund);
          syncedById.set(synced.id, synced);
          terminalLog(`  ✓ ${synced.name}`, 'success');
        } catch (err) {
          const message = err instanceof Error ? err.message : '同步失败';
          terminalLog(`  ✗ ${fund.name} · ${message}`, 'error');
          syncedById.set(fund.id, fund);
        }
      }
      if (syncedById.size > 0) {
        setFunds((prev) => prev.map((f) => syncedById.get(f.id) ?? f));
      }
      terminalLog('净值同步完毕', 'success');

      return true;
    },
    [terminalLog],
  );

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
        logChickenHealth(terminalLog, updated, result, '  ');
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
        logChickenHealth(terminalLog, updated, result, '    ');
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
    const tiers = list.map((f) => getChickenTier(updatedById.get(f.id) ?? f));
    const dying = tiers.filter((t) => t === 'dying').length;
    const weak = tiers.filter((t) => t === 'weak').length;
    const plump = tiers.filter((t) => t === 'great').length;

    let summary = `体检完毕 ${ok}/${results.length} 只`;
    if (dying > 0) summary += `，${dying} 只要死了`;
    else if (weak > 0) summary += `，${weak} 只营养不良`;
    else if (plump > 0) summary += `，${plump} 只膘肥体壮 🐣`;
    else summary += ' 都挺精神 🐣';

    terminalLog(summary, ok === results.length ? 'success' : ok > 0 ? 'info' : 'error');

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
              onConvert={() => setOverlay('convert')}
              onDeleteFund={() => handleDeleteFund(selectedFund.id)}
              onDeleteRecord={handleDeleteRecordById}
              onEditRecord={(tx) => {
                if (tx.kind === 'sell') {
                  alert('卖出清仓记录暂不支持编辑，如需修改请删除该条记录后重新操作');
                  return;
                }
                setEditingRecord(tx);
                setOverlay('edit-record');
              }}
              onSellClear={() => setOverlay('sell-clear')}
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

          {overlay === 'sell-clear' && selectedFund && (
            <SellClearForm
              fund={selectedFund}
              onBack={() => setOverlay('fund-detail')}
              onSubmit={handleSellClear}
            />
          )}

          {overlay === 'convert' && selectedFund && (
            <ConvertForm
              fund={selectedFund}
              onBack={() => setOverlay('fund-detail')}
              onSubmit={handleConvert}
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
