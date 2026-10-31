import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { setGrabbing } from "../../../shared/ui/grabCursor";
import { dropSlot } from "../domain/tabs";

/** Pixels the pointer must travel before a press on a tab becomes a drag (below that it's a click). */
const DRAG_THRESHOLD_PX = 4;
/** How far below the bar the pointer must go for a dragged tab to leave it (and stop reordering). */
const LEAVE_BAR_PX = 16;
const PRIMARY_BUTTON = 0;

/** The tab `id` left the bar (to be dropped elsewhere), or came back to it or was dropped (null). */
export type TabDragOut = (id: string | null) => void;

interface Press {
  id: string;
  startX: number;
  startY: number;
  /** Where in the tab it was grabbed, so it doesn't jump under the pointer. */
  grab: number;
  dragging: boolean;
}

interface Options {
  /** The strip holding the tabs; each tab carries `data-tab-id`. */
  track: RefObject<HTMLElement | null>;
  ids: string[];
  onMove: (id: string, to: number) => void;
  out: TabDragOut;
}

/**
 * Reordering tabs by dragging, as in a browser: the grabbed tab follows the pointer inside the strip
 * and, once its centre passes half of a neighbour, takes its slot while the others slide away (FLIP).
 * Dragged below the bar it goes back to its slot and `out` is told, so it can be dropped elsewhere
 * (where it lands is up to the drop target).
 * Pointer events on the window, not HTML5 drag and drop, so React moving the node doesn't end the drag.
 */
export function useTabDrag({ track, ids, onMove, out }: Options) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [outside, setOutside] = useState(false);
  const press = useRef<Press | null>(null);
  const pointerX = useRef(0);
  const pointerY = useRef(0);
  const isOutside = useRef(false);
  /** Each tab's position before the last reorder, to animate from. */
  const lefts = useRef(new Map<string, number>());
  const swallowClick = useRef(false);
  const latest = useRef({ ids, onMove, out });
  latest.current = { ids, onMove, out };

  const tabElement = (id: string) => track.current?.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(id)}"]`) ?? null;

  const snapshotLefts = () => {
    lefts.current = new Map(
      [...(track.current?.querySelectorAll<HTMLElement>("[data-tab-id]") ?? [])].map((el) => [el.dataset.tabId!, el.offsetLeft]),
    );
  };

  const setOut = (id: string | null) => {
    if (isOutside.current === (id !== null)) return;
    isOutside.current = id !== null;
    setOutside(id !== null);
    latest.current.out(id);
  };

  /**
   * Puts the dragged tab under the pointer and reorders when it crosses into another slot; below the
   * bar, it slides back to its slot instead.
   */
  const follow = () => {
    const p = press.current;
    const strip = track.current;
    const el = p && tabElement(p.id);
    if (!p?.dragging || !strip || !el) return;
    const box = strip.getBoundingClientRect();
    if (pointerY.current > box.bottom + LEAVE_BAR_PX) {
      el.style.transition = "";
      el.style.transform = "";
      setOut(p.id);
      return;
    }
    setOut(null);
    const inset = parseFloat(getComputedStyle(strip).paddingLeft) || 0;
    const width = el.offsetWidth;
    const left = Math.min(Math.max(pointerX.current - box.left - p.grab, inset), box.width - inset - width);
    el.style.transition = "none";
    el.style.transform = `translateX(${left - el.offsetLeft}px)`;

    const { ids: order, onMove: move } = latest.current;
    const slot = dropSlot(left - inset, width, order.length);
    if (slot !== order.indexOf(p.id)) move(p.id, slot);
  };

  useEffect(() => {
    const onPointerMove = (e: globalThis.PointerEvent) => {
      const p = press.current;
      if (!p) return;
      pointerX.current = e.clientX;
      pointerY.current = e.clientY;
      if (!p.dragging) {
        if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) < DRAG_THRESHOLD_PX) return;
        p.dragging = true;
        setGrabbing(true);
        snapshotLefts();
        setDraggingId(p.id);
      }
      follow();
    };
    const onPointerUp = () => {
      const p = press.current;
      press.current = null;
      if (!p?.dragging) return;
      setGrabbing(false);
      setOut(null);
      // Clearing both at once lets the CSS transition slide it into its slot.
      const el = tabElement(p.id);
      if (el) {
        el.style.transition = "";
        el.style.transform = "";
      }
      setDraggingId(null);
      // The click that ends a drag must not count as one; if none comes, forget it.
      swallowClick.current = true;
      setTimeout(() => (swallowClick.current = false));
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After a reorder the other tabs slide from where they were; the dragged one is re-placed under the pointer.
  const order = ids.join("\u0000");
  useLayoutEffect(() => {
    const dragged = press.current?.dragging ? press.current.id : null;
    if (!dragged) return;
    for (const el of track.current?.querySelectorAll<HTMLElement>("[data-tab-id]") ?? []) {
      const id = el.dataset.tabId!;
      const now = el.offsetLeft;
      const before = lefts.current.get(id);
      lefts.current.set(id, now);
      if (id === dragged || before === undefined || before === now) continue;
      el.style.transition = "none";
      el.style.transform = `translateX(${before - now}px)`;
      void el.offsetWidth; // apply the offset before animating it away
      el.style.transition = "";
      el.style.transform = "";
    }
    follow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  return {
    draggingId,
    /** The dragged tab is out of the bar. */
    outside,
    /** For each tab's `onPointerDown`. */
    onPointerDown: (id: string) => (e: PointerEvent<HTMLElement>) => {
      if (e.button !== PRIMARY_BUTTON || (e.target as HTMLElement).closest("button, input")) return;
      press.current = { id, startX: e.clientX, startY: e.clientY, grab: e.clientX - e.currentTarget.getBoundingClientRect().left, dragging: false };
      pointerX.current = e.clientX;
      pointerY.current = e.clientY;
    },
    /** True (once) for the click that ends a drag. */
    consumeClick: () => {
      const swallow = swallowClick.current;
      swallowClick.current = false;
      return swallow;
    },
  };
}
