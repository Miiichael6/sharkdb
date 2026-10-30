import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

export interface PillBox {
  left: number;
  width: number;
}

/**
 * Position of the active tab inside the strip, for the one highlight that slides between tabs.
 * Follows size changes too (tabs opened or closed, window resized). `ready` stays false for the
 * first placement so the highlight doesn't slide in from the left edge.
 */
export function useActivePill(track: RefObject<HTMLElement | null>, activeId: string | null, order: string) {
  const [pill, setPill] = useState<PillBox | null>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const strip = track.current;
    if (!strip) return;
    const measure = () => {
      const active = activeId === null ? null : strip.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(activeId)}"]`);
      setPill(active ? { left: active.offsetLeft, width: active.offsetWidth } : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [track, activeId, order]);

  useEffect(() => {
    if (pill === null || ready) return;
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, [pill, ready]);

  return { pill, ready };
}
