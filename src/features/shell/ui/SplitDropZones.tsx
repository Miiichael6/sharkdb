import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { dropSide } from "../domain/splitTabs";
import type { Side } from "../domain/tabs";
import { NEW_TAB_ICON, PaneSideIcon } from "./splitIcons";
import { TabDragGhost } from "./TabDragGhost";

/** Where a drop lands: a side of the shown tab, or the whole area (a tab of its own). */
export type DropTarget = Side | "whole";

interface Props {
  /** The shell area the overlay covers. */
  area: RefObject<HTMLElement | null>;
  /** Where the divider is (or would be): the zones split the area there. Null: no split, one zone. */
  ratio: number | null;
  /** Title of what's dragged, and its icon on the card that follows the pointer. */
  title: string;
  icon: ReactNode;
  onDrop: (target: DropTarget) => void;
}

const LABELS: Record<DropTarget, string> = { 0: "a la izquierda", 1: "a la derecha", whole: "en una pestaña nueva" };

/**
 * Shown while a tab or a collection is dragged: the area dims and a glass preview slides to the half
 * under the pointer (or covers it all), saying where it will open. Releasing over it drops there.
 */
export function SplitDropZones({ area, ratio, title, icon, onDrop }: Props) {
  const [target, setTarget] = useState<DropTarget | null>(null);
  const latest = useRef({ ratio, onDrop });
  latest.current = { ratio, onDrop };

  useEffect(() => {
    const targetAt = (e: PointerEvent): DropTarget | null => {
      const box = area.current?.getBoundingClientRect();
      const inside = box && e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
      if (!inside) return null;
      const { ratio: r } = latest.current;
      return r === null ? "whole" : dropSide(e.clientX, box.left, box.width, r);
    };
    const onMove = (e: PointerEvent) => setTarget(targetAt(e));
    const onUp = (e: PointerEvent) => {
      const at = targetAt(e);
      if (at !== null) latest.current.onDrop(at);
    };
    window.addEventListener("pointermove", onMove);
    // Capture, so it runs before the drag that shows it ends (and unmounts it).
    window.addEventListener("pointerup", onUp, true);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp, true);
    };
  }, [area]);

  const shown = target ?? (ratio === null ? "whole" : 0);
  const left = shown === 1 ? ratio! : 0;
  const width = shown === "whole" ? 1 : shown === 1 ? 1 - ratio! : ratio!;
  return (
    <>
      <div className={`split-drop ${target !== null ? "armed" : ""}`} aria-hidden>
        <div className="split-drop-preview" style={{ left: `${left * 100}%`, width: `${width * 100}%` }}>
          <div className="split-drop-chip">
            {shown === "whole" ? NEW_TAB_ICON : <PaneSideIcon side={shown} />}
            <span>
              Abrir «{title}» {LABELS[shown]}
            </span>
          </div>
        </div>
      </div>
      <TabDragGhost title={title} icon={icon} />
    </>
  );
}
