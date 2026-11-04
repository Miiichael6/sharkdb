import { useRef, type ReactNode } from "react";
import { useExclusivePopup } from "./useExclusivePopup";
import { useFitInWindow } from "./useFitInWindow";

/** The `.context-menu` list at (x, y), kept inside the window. */
export function MenuList({ x, y, onClose, children }: { x: number; y: number; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  useExclusivePopup(onClose);
  useFitInWindow(ref, x, y);
  return (
    <ul className="context-menu" style={{ left: x, top: y }} ref={ref}>
      {children}
    </ul>
  );
}
