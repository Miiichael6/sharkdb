import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  side: ReactNode;
  children: ReactNode;
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  sideClassName?: string;
}

/** Side panel + main area with a draggable vertical splitter between them. */
export function SplitPane({ side, children, initialWidth = 320, minWidth = 200, maxWidth = 640, sideClassName = "" }: Props) {
  const [width, setWidth] = useState(initialWidth);
  const dragging = useRef(false);

  useEffect(() => {
    const move = (e: MouseEvent) => dragging.current && setWidth(Math.min(Math.max(e.clientX, minWidth), maxWidth));
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
      <nav className={`split-side ${sideClassName}`} style={{ width }}>
        {side}
      </nav>
      <div className="splitter" onMouseDown={() => (dragging.current = true)} />
      <main className="split-main">{children}</main>
    </div>
  );
}
