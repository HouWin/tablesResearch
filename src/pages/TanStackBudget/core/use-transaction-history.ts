import { useRef, useState } from 'react';
import type { Transaction } from './types';

type History = { undo: Transaction[]; redo: Transaction[] };

/** Async commands must read the latest stack, including a just-finished edit. */
export function useTransactionHistory() {
  const [history, setHistory] = useState<History>({ undo: [], redo: [] });
  const current = useRef(history);
  const update = (next: History) => {
    current.current = next;
    setHistory(next);
  };
  return {
    ...history,
    clear: () => update({ undo: [], redo: [] }),
    record: (transaction: Transaction) =>
      update({
        undo: [...current.current.undo, transaction].slice(-100),
        redo: [],
      }),
    peek: (direction: 'undo' | 'redo') => current.current[direction].at(-1),
    acceptReplay: (direction: 'undo' | 'redo', transaction: Transaction) => {
      const { undo, redo } = current.current;
      update(
        direction === 'undo'
          ? { undo: undo.slice(0, -1), redo: [...redo, transaction] }
          : { undo: [...undo, transaction], redo: redo.slice(0, -1) },
      );
    },
  };
}
