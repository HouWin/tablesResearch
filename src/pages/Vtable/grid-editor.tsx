import { useEffect, useRef, type CSSProperties } from 'react';
import type { BudgetController } from '../TanStackBudget/core/use-budget-controller';
import { moveFocus } from './grid-keyboard';

export function GridEditor({
  controller: c,
  style,
}: {
  controller: BudgetController;
  style: CSSProperties;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  const composing = useRef(false);
  const cancelBlur = useRef(false);
  const focusFrame = useRef(0);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
    return () => cancelAnimationFrame(focusFrame.current);
  }, []);
  async function save(key?: string, backwards = false) {
    if (saving.current) return;
    saving.current = true;
    const ok = await c.finishEdit();
    saving.current = false;
    if (ok && key) {
      moveFocus(
        c,
        key === 'Enter' ? (backwards ? -1 : 1) : 0,
        key === 'Tab' ? (backwards ? -1 : 1) : 0,
        false,
        key === 'Tab',
      );
      c.gridRef.current?.focus();
    } else if (!ok) {
      // React must remove the saving/disabled state before the input can focus.
      focusFrame.current = requestAnimationFrame(() => ref.current?.focus());
    }
  }
  return (
    <input
      ref={ref}
      className="tb-cell-editor vt-editor"
      style={style}
      aria-label={`编辑 ${c.selectedAddress}`}
      aria-invalid={Boolean(c.editError)}
      aria-describedby={c.editError ? 'vtable-edit-error' : undefined}
      autoComplete="off"
      spellCheck={false}
      value={c.editing?.draft ?? ''}
      readOnly={c.busy}
      onChange={(event) =>
        c.setEditing((current) =>
          current ? { ...current, draft: event.target.value } : null,
        )
      }
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={() => {
        composing.current = false;
      }}
      onBlur={() => {
        if (!cancelBlur.current && !composing.current) void save();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (composing.current || event.nativeEvent.isComposing || c.busy)
          return;
        if (event.key === 'Escape') {
          event.preventDefault();
          cancelBlur.current = true;
          c.setEditing(null);
          c.gridRef.current?.focus();
        } else if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault();
          void save(event.key, event.shiftKey);
        }
      }}
    />
  );
}
