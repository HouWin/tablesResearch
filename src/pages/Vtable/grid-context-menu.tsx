import { useEffect, useRef } from 'react';
import type { BudgetController } from '../TanStackBudget/core/use-budget-controller';

export function GridContextMenu({
  controller: c,
  position,
  close,
}: {
  controller: BudgetController;
  position: { x: number; y: number };
  close: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    // The menu opens during VTable's pointerdown. Capture avoids closing it again
    // when that same opening event reaches document's bubble phase.
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [close]);
  const actions: [string, () => void][] = [
    ['复制', () => void c.copy()],
    ['剪切', () => void c.copy(true)],
    ['粘贴', () => void c.paste()],
    ['清空', () => void c.clear()],
    ['批注', () => c.setPanel('comment')],
    ['历史', () => c.setPanel('history')],
    ['附件', () => c.setPanel('attachment')],
    ['数据追踪', () => c.setPanel('lineage')],
  ];
  return (
    <div
      ref={ref}
      className="tb-context-menu"
      role="menu"
      aria-label="单元格操作"
      style={{
        left: Math.max(0, Math.min(position.x, window.innerWidth - 200)),
        top: Math.max(0, Math.min(position.y, window.innerHeight - 350)),
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          close();
          c.gridRef.current?.focus();
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const buttons = [
            ...(ref.current?.querySelectorAll<HTMLButtonElement>(
              'button:not(:disabled)',
            ) ?? []),
          ];
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          buttons[
            (index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) %
              buttons.length
          ]?.focus();
        }
      }}
    >
      {actions.map(([label, action]) => (
        <button
          key={label}
          role="menuitem"
          disabled={c.busy}
          onClick={() => {
            action();
            close();
          }}
        >
          {label}
        </button>
      ))}
      <button
        role="menuitem"
        disabled={c.busy || !c.selectedRow?.productIsGroup}
        onClick={() => {
          if (c.selectedRow)
            c.changeQuery({
              ...c.data.query,
              drillPath: [
                ...c.selectedRow.productAncestorIds,
                c.selectedRow.productId,
              ],
            });
          close();
        }}
      >
        下钻到下一级
      </button>
    </div>
  );
}
