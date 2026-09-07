import type { ButtonHTMLAttributes } from 'react';

/** A temporary request lock preserves focus and appearance; unavailable actions use disabled. */
export function BudgetCommand({
  pending = false,
  disabled,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { pending?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled}
      aria-disabled={disabled || pending || undefined}
      data-pending={pending || undefined}
      onClick={(event) => {
        if (pending || disabled) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event);
      }}
    />
  );
}
