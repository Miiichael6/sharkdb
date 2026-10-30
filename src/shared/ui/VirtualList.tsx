import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/** Rows drawn above and below the visible ones, so fast scrolling doesn't show blanks. */
const OVERSCAN = 8;

interface Props {
  count: number;
  rowHeight: number;
  renderRow: (index: number) => ReactNode;
  /** Sticky content above the rows (column headers); scrolls sideways with them. */
  header?: ReactNode;
  /** Row kept in view, e.g. the one selected with the keyboard. */
  activeIndex?: number;
  className?: string;
  role?: string;
  ariaLabel?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
}

/** Scrollable list of fixed-height rows that only mounts the rows on screen. */
export function VirtualList({ count, rowHeight, renderRow, header, activeIndex, className = "", role, ariaLabel, onKeyDown }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = scroller.current!;
    const observer = new ResizeObserver(() => setHeight(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el || activeIndex === undefined || activeIndex < 0) return;
    const top = activeIndex * rowHeight;
    const headerHeight = el.scrollHeight - count * rowHeight;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + rowHeight > el.scrollTop + el.clientHeight - headerHeight) el.scrollTop = top + rowHeight - el.clientHeight + headerHeight;
  }, [activeIndex, rowHeight, count]);

  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
  const last = Math.min(count, Math.ceil((scrollTop + height) / rowHeight) + OVERSCAN);
  const rows: ReactNode[] = [];
  for (let i = first; i < last; i++) rows.push(renderRow(i));

  return (
    <div
      ref={scroller}
      className={`virtual-list ${className}`}
      role={role}
      aria-label={ariaLabel}
      aria-rowcount={count}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      {header}
      <div className="virtual-body" style={{ height: count * rowHeight }}>
        <div style={{ transform: `translateY(${first * rowHeight}px)` }}>{rows}</div>
      </div>
    </div>
  );
}
