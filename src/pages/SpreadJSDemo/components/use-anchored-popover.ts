import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';

/** 定位、视口避让、点击外部关闭和 Escape 关闭的统一工具栏弹层行为。 */
export function useAnchoredPopover(
  anchorRef: RefObject<HTMLElement>,
  onClose: () => void,
) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  onCloseRef.current = onClose;

  const close = useCallback(
    (restoreFocus = true) => {
      onCloseRef.current();
      if (restoreFocus) {
        window.requestAnimationFrame(() => {
          const anchor = anchorRef.current;
          const focusTarget =
            anchor instanceof HTMLButtonElement
              ? anchor
              : anchor?.querySelector<HTMLButtonElement>('button');
          focusTarget?.focus();
        });
      }
    },
    [anchorRef],
  );

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const popover = popoverRef.current;
    if (!anchor || !popover) return;

    let animationFrame = 0;
    const updatePosition = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const anchorRect = anchor.getBoundingClientRect();
        const popoverRect = popover.getBoundingClientRect();
        const margin = 12;
        const gap = 6;
        const maxLeft = Math.max(
          margin,
          window.innerWidth - popoverRect.width - margin,
        );
        const left = Math.min(Math.max(anchorRect.left, margin), maxLeft);
        const spaceBelow = window.innerHeight - anchorRect.bottom - margin;
        const top =
          spaceBelow >= popoverRect.height
            ? anchorRect.bottom + gap
            : Math.max(margin, anchorRect.top - popoverRect.height - gap);
        setStyle({ left, top, visibility: 'visible' });
      });
    };

    updatePosition();
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(updatePosition);
    resizeObserver?.observe(anchor);
    resizeObserver?.observe(popover);
    window.addEventListener('resize', updatePosition);
    document.addEventListener('scroll', updatePosition, true);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        anchorRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      )
        return;
      close(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close();
    };
    document.addEventListener('pointerdown', closeOnOutsidePress, true);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress, true);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [anchorRef, close]);

  return { popoverRef, style, close };
}
