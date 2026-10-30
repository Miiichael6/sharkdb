import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";

const MIN_COLUMN_WIDTH = 40;

/** Widths of resizable columns by id; columns not dragged yet use `defaultWidth`. */
export function useColumnWidths(defaultWidth: number | ((id: string) => number)) {
  const [widths, setWidths] = useState<Record<string, number>>({});
  const drag = useRef<{ id: string; startX: number; startWidth: number } | null>(null);

  const widthOf = useCallback(
    (id: string) => widths[id] ?? (typeof defaultWidth === "number" ? defaultWidth : defaultWidth(id)),
    [widths, defaultWidth],
  );

  useEffect(() => {
    const move = (e: globalThis.MouseEvent) => {
      const d = drag.current;
      if (d) setWidths((w) => ({ ...w, [d.id]: Math.max(MIN_COLUMN_WIDTH, d.startWidth + e.clientX - d.startX) }));
    };
    const up = () => (drag.current = null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  const startResize = (id: string, e: MouseEvent) => {
    e.preventDefault();
    drag.current = { id, startX: e.clientX, startWidth: widthOf(id) };
  };

  return { widthOf, startResize };
}
