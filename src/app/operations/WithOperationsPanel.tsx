import { useEffect, useRef, useState, type ReactNode } from "react";
import { OperationsPanel } from "./OperationsPanel";
import { useOperations } from "./useOperations";

const MIN_WIDTH = 260;
const MAX_WIDTH = 720;
/** The main area keeps at least this width however far the splitter is dragged. */
const MIN_MAIN_WIDTH = 360;

/** The main area with the operations panel on its right while it is open; the splitter resizes it. */
export function WithOperationsPanel({ children }: { children: ReactNode }) {
  const { panelOpen } = useOperations();
  const [width, setWidth] = useState(340);
  const container = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const box = container.current?.getBoundingClientRect();
      if (!dragging.current || !box) return;
      const max = Math.min(MAX_WIDTH, box.width - MIN_MAIN_WIDTH);
      setWidth(Math.max(Math.min(box.right - e.clientX, max), MIN_WIDTH));
    };
    const up = () => (dragging.current = false);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  return (
    <div className="with-ops" ref={container}>
      <div className="with-ops-main">{children}</div>
      {panelOpen && (
        <>
          <div className="splitter" onMouseDown={() => (dragging.current = true)} />
          <OperationsPanel width={width} />
        </>
      )}
    </div>
  );
}
