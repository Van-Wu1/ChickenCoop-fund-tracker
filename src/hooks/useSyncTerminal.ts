import { useCallback, useState } from 'react';

export type TerminalLineType = 'info' | 'success' | 'error' | 'dim' | 'prompt';

export interface TerminalLine {
  id: string;
  text: string;
  type: TerminalLineType;
}

const WELCOME: TerminalLine = {
  id: 'welcome',
  text: '嗨嗨农场主，今天小鸡们的表现怎么样？',
  type: 'info',
};

export function useSyncTerminal() {
  const [lines, setLines] = useState<TerminalLine[]>([WELCOME]);

  const log = useCallback((text: string, type: TerminalLineType = 'info') => {
    setLines((prev) => [
      ...prev.slice(-150),
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text,
        type,
      },
    ]);
  }, []);

  const clear = useCallback(() => {
    setLines([WELCOME]);
  }, []);

  return { lines, log, clear };
}
