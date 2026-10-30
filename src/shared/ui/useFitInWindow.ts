import { useLayoutEffect, type RefObject } from "react";

/** Gap kept between a floating element and the window edges. */
const EDGE = 8;
/** Below this much room under the anchor the element moves up instead of scrolling. */
const MIN_ROOM = 200;

/**
 * Places a fixed element at (x, y) but inside the window: it scrolls when taller than the room
 * below the anchor, and only moves up when that room is too short to be useful.
 * The element needs `overflow-y: auto` for the scrolling part.
 */
export function useFitInWindow(ref: RefObject<HTMLElement | null>, x: number, y: number) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const below = window.innerHeight - y - EDGE;
    let top = y;
    let maxHeight = below;
    if (el.scrollHeight > below && below < MIN_ROOM) {
      top = Math.max(EDGE, window.innerHeight - el.scrollHeight - EDGE);
      maxHeight = window.innerHeight - top - EDGE;
    }
    el.style.top = `${top}px`;
    el.style.maxHeight = `${maxHeight}px`;
    el.style.left = `${Math.max(EDGE, Math.min(x, window.innerWidth - el.offsetWidth - EDGE))}px`;
  }, [ref, x, y]);
}
