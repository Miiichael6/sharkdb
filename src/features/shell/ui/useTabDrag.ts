import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { dropSlot } from "../domain/tabs";

/** Pixels the pointer must travel before a press on a tab becomes a drag (below that it's a click). */
const DRAG_THRESHOLD_PX = 4;
const PRIMARY_BUTTON = 0;

interface Press {
  id: string;
  startX: number;
  /** Where in the tab it was grabbed, so it doesn't jump under the pointer. */
  grab: number;
  dragging: boolean;
}

interface Options {
  /** The strip holding the tabs; each tab carries `data-tab-id`. */
  track: RefObject<HTMLElement | null>;
  ids: string[];
  onMove: (id: string, to: number) => void;
}

/**
 * Reordering tabs by dragging, as in a browser: the grabbed tab follows the pointer inside the strip
 * and, once its centre passes half of a neighbour, takes its slot while the others slide away (FLIP).
 * Pointer events on the window, not HTML5 drag and drop, so React moving the node doesn't end the drag.
 */
export function useTabDrag({ track, ids, onMove }: Options) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const press = useRef<Press | null>(null);
  const pointerX = useRef(0);
  /** Each tab's position before the last reorder, to animate from. */
  const lefts = useRef(new Map<string, number>());
  const swallowClick = useRef(false);
  const latest = useRef({ ids, onMove });
  latest.current = { ids, onMove };

  const tabElement = (id: string) => track.current?.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(id)}"]`) ?? null;

  const snapshotLefts = () => {
    lefts.current = new Map(
      [...(track.current?.querySelectorAll<HTMLElement>("[data-tab-id]") ?? [])].map((el) => [el.dataset.tabId!, el.offsetLeft]),
    );
  };

  /** Puts the dragged tab under the pointer and reorders when it crosses into another slot. */
  const follow = () => {
    const p = press.current;
    const strip = track.current;
    const el = p && tabElement(p.id);
    if (!p?.dragging || !strip || !el) return;
    const box = strip.getBoundingClientRect();
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
      if (!p.dragging) {
        if (Math.abs(e.clientX - p.startX) < DRAG_THRESHOLD_PX) return;
        p.dragging = true;
        snapshotLefts();
        setDraggingId(p.id);
      }
      follow();
    };
    const onPointerUp = () => {
      const p = press.current;
      press.current = null;
      if (!p?.dragging) return;
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
    /** For each tab's `onPointerDown`. */
    onPointerDown: (id: string) => (e: PointerEvent<HTMLElement>) => {
      if (e.button !== PRIMARY_BUTTON || (e.target as HTMLElement).closest("button, input")) return;
      press.current = { id, startX: e.clientX, grab: e.clientX - e.currentTarget.getBoundingClientRect().left, dragging: false };
      pointerX.current = e.clientX;
    },
    /** True (once) for the click that ends a drag. */
    consumeClick: () => {
      const swallow = swallowClick.current;
      swallowClick.current = false;
      return swallow;
    },
  };
}
