import type { KeyboardEvent, PointerEvent, RefObject } from "react";
import { clampRatio, DEFAULT_SPLIT_RATIO } from "../domain/splitTabs";

/** Share of the width an arrow key moves the divider. */
const KEY_STEP = 0.02;

interface Props {
  /** The area the two panes share. */
  area: RefObject<HTMLElement | null>;
  ratio: number;
  /** Flex order that puts it between the panes. */
  order: number;
  onChange: (ratio: number) => void;
}

/**
 * Draggable line between the panes of a split: 1px seen, wider to grab. Double click centres it;
 * with focus, the arrow keys move it.
 */
export function SplitDivider({ area, ratio, order, onChange }: Props) {
  const ratioAt = (x: number) => {
    const box = area.current?.getBoundingClientRect();
    return box ? clampRatio((x - box.left) / box.width, box.width) : ratio;
  };

  const startDrag = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    document.body.classList.add("resizing-columns");
    const move = (m: globalThis.PointerEvent) => onChange(ratioAt(m.clientX));
    const stop = () => {
      document.body.classList.remove("resizing-columns");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowLeft" ? -KEY_STEP : e.key === "ArrowRight" ? KEY_STEP : 0;
    if (!step) return;
    e.preventDefault();
    onChange(clampRatio(ratio + step, area.current?.clientWidth ?? 0));
  };

  return (
    <div
      className="split-divider"
      style={{ order }}
      role="separator"
      aria-orientation="vertical"
      aria-label="Redimensionar paneles"
      aria-valuenow={Math.round(ratio * 100)}
      tabIndex={0}
      onPointerDown={startDrag}
      onDoubleClick={() => onChange(DEFAULT_SPLIT_RATIO)}
      onKeyDown={onKeyDown}
    />
  );
}
