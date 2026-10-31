import { useEffect, useRef, useState, type ReactNode } from "react";

/** Offset of the card from the pointer: its top-left corner sits right at the tip. */
const POINTER_OFFSET_PX = 0;

/**
 * Card with the dragged tab's (or collection's) title that follows the pointer while the tab is out of the bar. Moved
 * straight on the element, so following the pointer doesn't re-render anything.
 */
export function TabDragGhost({ title, icon }: { title: string; icon: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      el.style.transform = `translate(${e.clientX + POINTER_OFFSET_PX}px, ${e.clientY + POINTER_OFFSET_PX}px)`;
      setShown(true);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div ref={ref} className={`tab-ghost ${shown ? "shown" : ""}`} aria-hidden>
      <div className="tab-ghost-card">
        {icon}
        <span>{title}</span>
      </div>
    </div>
  );
}
