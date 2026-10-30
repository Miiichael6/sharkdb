import { useRef, type ReactNode } from "react";
import { useFitInWindow } from "./useFitInWindow";

/** The `.context-menu` list at (x, y), kept inside the window. */
export function MenuList({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  useFitInWindow(ref, x, y);
  return (
    <ul className="context-menu" style={{ left: x, top: y }} ref={ref}>
      {children}
    </ul>
  );
}
