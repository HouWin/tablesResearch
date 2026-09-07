import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { COLUMNS } from '../TanStackBudget/core/columns';
import { bounds } from '../TanStackBudget/core/types';
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
  const [offset, setOffset] = useState(position);
  const box = bounds(c.range);
  const readOnly = c.visibleColumns.some(
    (col) => col >= box.left && col <= box.right && !COLUMNS[col].editable,
  );
  const disabled = c.busy || c.data.loading || Boolean(c.data.error);
  const dismiss = () => {
    close();
    c.gridRef.current?.focus();
  };
  useLayoutEffect(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect)
      setOffset({
        x: Math.max(
          8,
          Math.min(position.x, window.innerWidth - rect.width - 8),
        ),
        y: Math.max(
          8,
          Math.min(position.y, window.innerHeight - rect.height - 8),
        ),
      });
  }, [position]);
  useEffect(() => {
    ref.current
      ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
      ?.focus();
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    // The menu opens during VTable's pointerdown. Capture avoids closing it again
    // when that same opening event reaches document's bubble phase.
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('resize', close);
    };
  }, [close]);
  const actions: [string, () => void, boolean?][] = [
    ['复制', () => void c.copy()],
    ['剪切', () => void c.copy(true), readOnly],
    ['粘贴', () => void c.paste(), !COLUMNS[box.left].editable],
    ['清空', () => void c.clear(), readOnly],
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
        left: offset.x,
        top: offset.y,
        maxHeight: 'calc(100dvh - 16px)',
        overflowY: 'auto',
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape' || event.key === 'Tab') {
          event.preventDefault();
          dismiss();
        }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          const buttons = [
            ...(ref.current?.querySelectorAll<HTMLButtonElement>(
              'button:not(:disabled)',
            ) ?? []),
          ];
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
              ? buttons.length - 1
              : (index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) %
                buttons.length;
          buttons[next]?.focus();
        }
      }}
    >
      {actions.map(([label, action, unavailable]) => (
        <button
          key={label}
          role="menuitem"
          disabled={disabled || unavailable}
          title={unavailable ? '选区包含只读的组织或科目列' : undefined}
          onClick={() => {
            dismiss();
            action();
          }}
        >
          {label}
        </button>
      ))}
      <button
        role="menuitem"
        disabled={disabled || !c.selectedRow?.productIsGroup}
        onClick={() => {
          if (c.selectedRow)
            c.changeQuery({
              ...c.data.query,
              drillPath: [
                ...c.selectedRow.productAncestorIds,
                c.selectedRow.productId,
              ],
            });
          dismiss();
        }}
      >
        下钻到下一级
      </button>
    </div>
  );
}
