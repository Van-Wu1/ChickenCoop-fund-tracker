import type { Tab } from '../../types';
import type { TerminalLine } from '../../hooks/useSyncTerminal';
import { SyncTerminal } from './SyncTerminal';

const NAV: { id: Tab; label: string }[] = [
  { id: 'holdings', label: '持有' },
  { id: 'market', label: '行情' },
  { id: 'settings', label: '设置' },
];

interface SideNavProps {
  active: Tab;
  onChange: (tab: Tab) => void;
  terminalLines: TerminalLine[];
}

export function SideNav({ active, onChange, terminalLines }: SideNavProps) {
  return (
    <aside className="side-nav">
      <nav aria-label="主导航" className="side-nav-menu">
        {NAV.map((item) => (
          <button
            key={item.id}
            className={`side-nav-link${active === item.id ? ' active' : ''}`}
            onClick={() => onChange(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </nav>
      <SyncTerminal lines={terminalLines} />
    </aside>
  );
}
