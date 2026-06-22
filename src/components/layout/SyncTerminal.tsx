import { useEffect, useRef } from 'react';
import type { TerminalLine } from '../../hooks/useSyncTerminal';

interface SyncTerminalProps {
  lines: TerminalLine[];
}

export function SyncTerminal({ lines }: SyncTerminalProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lines]);

  return (
    <div className="sync-terminal">
      <div className="sync-terminal-header">
        <span className="sync-terminal-dot" />
        <span className="sync-terminal-title">鸡窝</span>
      </div>
      <div ref={bodyRef} className="sync-terminal-body">
        {lines.map((line) => (
          <div key={line.id} className={`sync-terminal-line sync-terminal-${line.type}`}>
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}
