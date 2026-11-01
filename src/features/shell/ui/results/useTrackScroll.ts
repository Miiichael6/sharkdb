import { useCallback, useEffect, useState, type RefObject, type WheelEvent } from "react";

/** Slack in pixels before an end counts as reached (scroll offsets can be fractional). */
const EDGE_SLACK = 1;
/** Share of the visible width one arrow click scrolls, leaving a tab in view for context. */
const PAGE_SHARE = 0.8;

interface Edges {
  start: boolean;
  end: boolean;
}

/**
 * Horizontal scrolling of a tab track that holds more tabs than fit: whether each end is reached,
 * paging by arrows, the vertical wheel turned sideways, and the selected tab kept in view.
 * `contentKey` changes whenever the tabs do.
 */
export function useTrackScroll(track: RefObject<HTMLElement | null>, selectedId: string | null, contentKey: string) {
  const [edges, setEdges] = useState<Edges>({ start: true, end: true });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const start = el.scrollLeft <= EDGE_SLACK;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - EDGE_SLACK;
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, [track]);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [track, measure, contentKey]);

  useEffect(() => {
    if (!selectedId) return;
    track.current
      ?.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(selectedId)}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [track, selectedId, contentKey]);

  const page = (direction: 1 | -1) => {
    const el = track.current;
    el?.scrollBy({ left: direction * el.clientWidth * PAGE_SHARE, behavior: "smooth" });
  };

  // A mouse wheel only scrolls vertically; on the track it moves the tabs sideways.
  const onWheel = (e: WheelEvent<HTMLElement>) => {
    if (e.deltaY && !e.deltaX) e.currentTarget.scrollLeft += e.deltaY;
  };

  return { overflows: !(edges.start && edges.end), atStart: edges.start, atEnd: edges.end, page, onWheel };
}
