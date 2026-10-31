import { useLayoutEffect, type RefObject } from "react";

/** Gap kept between a floating element and the window edges. */
const EDGE = 8;

/**
 * Places a fixed element at (x, y), scrolling it only as a last resort: it opens downwards when
 * it fits below the anchor, upwards (ending at the anchor) when it fits above, otherwise it moves
 * just enough to stay whole inside the window, and when taller than the window it fills it and
 * scrolls. The element needs `overflow-y: auto` for that last case. With `flipX`, an element that
 * doesn't fit right of `x` opens leftwards, ending at `flipX` (a submenu beside its parent item).
 */
export function useFitInWindow(ref: RefObject<HTMLElement | null>, x: number, y: number, flipX?: number) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.maxHeight = "";
    const room = window.innerHeight - 2 * EDGE;
    if (el.offsetHeight > room) el.style.maxHeight = `${room}px`;
    const height = el.offsetHeight;
    const fitsBelow = y + height <= window.innerHeight - EDGE;
    const fitsAbove = y - height >= EDGE;
    const top = fitsBelow
      ? y
      : fitsAbove
        ? y - height
        : Math.max(EDGE, window.innerHeight - height - EDGE);
    el.style.top = `${top}px`;
    const width = el.offsetWidth;
    const fitsRight = x + width <= window.innerWidth - EDGE;
    const left = !fitsRight && flipX !== undefined && flipX - width >= EDGE ? flipX - width : x;
    el.style.left = `${Math.max(EDGE, Math.min(left, window.innerWidth - width - EDGE))}px`;
  }, [ref, x, y, flipX]);
}
