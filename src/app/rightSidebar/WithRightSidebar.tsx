import { useEffect, useRef, useState, type ReactNode } from "react";
import { RightSidebar } from "./RightSidebar";
import { useRightSidebar } from "./useRightSidebar";

const MIN_WIDTH = 260;
const MAX_WIDTH = 720;
/** The main area keeps at least this width however far the splitter is dragged. */
const MIN_MAIN_WIDTH = 360;

/** The main area with the right sidebar while it is open; the splitter resizes it. */
export function WithRightSidebar({ children }: { children: ReactNode }) {
  const { tab } = useRightSidebar();
  const [width, setWidth] = useState(360);
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
      {tab && (
        <>
          <div className="splitter" onMouseDown={() => (dragging.current = true)} />
          <RightSidebar tab={tab} width={width} />
        </>
      )}
    </div>
  );
}
