import { useRef, useState } from 'react';
import type { Fund } from '../types';
import type { SyncResult } from '../utils/applyNavUpdate';
import { exportFundsJson, exportFundsXlsx } from '../utils/exportData';
import {
  IMPORT_ACCEPT,
  importFundsFromFile,
  type ImportResult,
} from '../utils/importData';

interface SettingsPageProps {
  funds: Fund[];
  onImport: (data: ImportResult) => boolean;
  onSyncAll: () => Promise<SyncResult[]>;
  onReset: () => void;
}

export function SettingsPage({
  funds,
  onImport,
  onSyncAll,
  onReset,
}: SettingsPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const handleImportClick = () => {
    setImportMsg(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImporting(true);
    setImportMsg(null);
    try {
      const data = await importFundsFromFile(file);
      if (onImport(data)) {
        setImportMsg(`已导入 ${data.funds.length} 只基金`);
      }
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : '导入失败');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="page-head">
        <div className="page-head-main">
          <h1 className="page-title">设置</h1>
          <p className="page-desc">数据同步与导入导出</p>
        </div>
      </div>

      <div className="settings-group">
        <button
          className="settings-row"
          onClick={() => onSyncAll()}
          type="button"
        >
          <span>同步全部净值</span>
          <span className="chevron">›</span>
        </button>
      </div>

      <p className="settings-group-label">导入 / 导出</p>
      <div className="settings-group">
        <input
          ref={fileInputRef}
          accept={IMPORT_ACCEPT}
          hidden
          onChange={(e) => void handleFileChange(e)}
          type="file"
        />
        <button
          className="settings-row"
          disabled={importing}
          onClick={handleImportClick}
          type="button"
        >
          <span>{importing ? '导入中…' : '导入数据'}</span>
          <span className="settings-row-hint">支持 .json / .xlsx</span>
        </button>
        <button
          className="settings-row"
          onClick={() => exportFundsJson(funds)}
          type="button"
        >
          <span>导出 JSON</span>
          <span className="settings-row-hint">含全部持有数据</span>
        </button>
        <button
          className="settings-row"
          onClick={() => void exportFundsXlsx(funds)}
          type="button"
        >
          <span>导出 Excel (.xlsx)</span>
          <span className="settings-row-hint">汇总 + 交易记录</span>
        </button>
      </div>

      {importMsg && (
        <p className={`settings-import-msg${importMsg.startsWith('已') ? '' : ' error'}`}>
          {importMsg}
        </p>
      )}

      <div className="settings-group">
        <button className="settings-row" onClick={onReset} type="button">
          <span className="danger-text">重置为 Excel 初始数据</span>
        </button>
      </div>

      <p className="settings-footer">
        数据来源：东方财富 · 天天基金
      </p>
    </div>
  );
}
