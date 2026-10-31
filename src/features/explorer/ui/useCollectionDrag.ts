import { useEffect, useRef, type PointerEvent } from "react";
import { setGrabbing } from "../../../shared/ui/grabCursor";
import type { TreeNode } from "../domain/tree";

/** Pixels the pointer must travel before a press on a row becomes a drag (below that it's a click). */
const DRAG_THRESHOLD_PX = 6;
const PRIMARY_BUTTON = 0;

/**
 * Dragging a collection out of the tree (onto the shell area, which decides where it lands). Pointer
 * events on the window, as the shell's tabs do, rather than HTML5 drag and drop. `onChange` gets the
 * dragged collection once the drag starts and null once it ends.
 */
export function useCollectionDrag(onChange: ((node: TreeNode | null) => void) | undefined) {
  const press = useRef<{ node: TreeNode; x: number; y: number; dragging: boolean } | null>(null);
  const latest = useRef(onChange);
  latest.current = onChange;

  useEffect(() => {
    const onPointerMove = (e: globalThis.PointerEvent) => {
      const p = press.current;
      if (!p || p.dragging || Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_THRESHOLD_PX) return;
      p.dragging = true;
      setGrabbing(true);
      latest.current?.(p.node);
    };
    const onPointerUp = () => {
      const p = press.current;
      press.current = null;
      if (!p?.dragging) return;
      setGrabbing(false);
      latest.current?.(null);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  /** For a row's `onPointerDown`: only collections can be dragged. */
  return (node: TreeNode) => (e: PointerEvent<HTMLElement>) => {
    if (!latest.current || node.kind !== "collection" || e.button !== PRIMARY_BUTTON) return;
    press.current = { node, x: e.clientX, y: e.clientY, dragging: false };
  };
}
