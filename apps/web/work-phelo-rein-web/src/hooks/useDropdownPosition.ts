import { useCallback, useEffect, useState, type RefObject } from 'react';

export interface DropdownPosition {
  left: number;
  width: number;
  maxHeight: number;
  placement: 'bottom' | 'top';
  /** set when placement is 'bottom' */
  top?: number;
  /** set when placement is 'top' — distance from the viewport bottom, so the dropdown grows upward */
  bottom?: number;
}

const GAP = 6;
const VIEWPORT_MARGIN = 12;
/** below this much room, prefer flipping to the side with more space */
const PREFERRED_HEIGHT = 180;

/**
 * Positions a portaled dropdown against a trigger element, flipping above the trigger
 * when there isn't enough room below (and vice versa), and capping maxHeight so the
 * dropdown always stays within the viewport instead of spilling past it — e.g. over a
 * SidePanel's rounded edge or behind other fixed page chrome.
 */
export function useDropdownPosition(open: boolean, triggerRef: RefObject<HTMLElement | null>) {
  const [pos, setPos] = useState<DropdownPosition>({
    left: 0,
    width: 0,
    maxHeight: 320,
    placement: 'bottom',
    top: 0,
  });

  const update = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom - GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - GAP - VIEWPORT_MARGIN;

    const placement: DropdownPosition['placement'] =
      spaceBelow < PREFERRED_HEIGHT && spaceAbove > spaceBelow ? 'top' : 'bottom';

    setPos({
      left: rect.left,
      width: rect.width,
      placement,
      maxHeight: Math.max(120, placement === 'bottom' ? spaceBelow : spaceAbove),
      top: placement === 'bottom' ? rect.bottom + GAP : undefined,
      bottom: placement === 'top' ? viewportHeight - rect.top + GAP : undefined,
    });
  }, [triggerRef]);

  useEffect(() => {
    if (!open) return;
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, update]);

  return { pos, updatePos: update };
}
