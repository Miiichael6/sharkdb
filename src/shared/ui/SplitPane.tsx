import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  side: ReactNode;
  children: ReactNode;
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  sideClassName?: string;
  /** Hides the side panel (and its splitter); the main area takes the whole width. */
  sideHidden?: boolean;
}

/** The main area keeps at least this width however far the splitter is dragged. */
const MIN_MAIN_WIDTH = 360;

/** Side panel + main area with a draggable vertical splitter between them. */
export function SplitPane({ side, children, initialWidth = 320, minWidth = 200, maxWidth = 640, sideClassName = "", sideHidden = false }: Props) {
  const [width, setWidth] = useState(initialWidth);
  const dragging = useRef(false);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      const max = Math.min(maxWidth, window.innerWidth - MIN_MAIN_WIDTH);
      setWidth(Math.max(Math.min(e.clientX, max), minWidth));
    };
    const up = () => (dragging.current = false);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [minWidth, maxWidth]);

  return (
    <div className="split-pane">
      {!sideHidden && (
        <>
          <nav className={`split-side ${sideClassName}`} style={{ width }}>
            {side}
          </nav>
          <div className="splitter" onMouseDown={() => (dragging.current = true)} />
        </>
      )}
      <main className="split-main">{children}</main>
    </div>
  );
}
