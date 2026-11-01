import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

/** Heights the top pane's content asks for, in px. */
export interface TopFit {
  /** What it opens at (and goes back to while not dragged). */
  height: number;
  /** The least it can be dragged to. */
  min: number;
  /** The most it ever needs: dragging taller than this leaves empty space that the next fit removes. */
  max: number;
}

interface Props {
  top: ReactNode;
  bottom: ReactNode;
  /** Share of the height the top pane takes until it can be measured (0..1). */
  initialRatio?: number;
  /** Smallest height the bottom pane can be squeezed to. */
  minPx?: number;
  label?: string;
  /** Hides the top pane (it stays mounted) and gives all the height to the bottom one. */
  topHidden?: boolean;
  /** Hides the bottom pane (it stays mounted) and gives all the height to the top one. */
  bottomHidden?: boolean;
  /** Sizes the top pane to its content; measured when shown and whenever `fitKey` changes. */
  fitTop?: (top: HTMLElement) => TopFit;
  fitKey?: unknown;
}

/** Arrow keys move the splitter by this share of the height. */
const KEY_STEP = 0.05;

const clampTo = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * Two panes stacked vertically with a draggable horizontal splitter between them. With `fitTop` the
 * top pane follows its content: it opens at `height`, and a hand-picked size is kept only within
 * `height..max`, so emptying the content always shrinks it back.
 */
export function StackSplit(props: Props) {
  const { top, bottom, initialRatio = 0.4, minPx = 80, label = "Redimensionar", topHidden, bottomHidden, fitTop, fitKey } = props;
  const box = useRef<HTMLDivElement>(null);
  const topBox = useRef<HTMLDivElement>(null);
  // null until measured (or without fitTop and not yet dragged): initialRatio applies.
  const [topPx, setTopPx] = useState<number | null>(null);
  const [minTop, setMinTop] = useState(minPx);
  const dragged = useRef(false);

  const boxHeight = () => box.current?.clientHeight ?? 0;
  /** Keeps the bottom pane at least `minPx` tall (when there is room for both). */
  const withRoom = (px: number, min: number) => {
    const room = boxHeight() - minPx;
    return room > min ? Math.min(px, room) : px;
  };

  // Measured after the children's effects (an editor builds its DOM there), while the pane is visible.
  useEffect(() => {
    if (topHidden || !fitTop || !topBox.current) return;
    const fit = fitTop(topBox.current);
    if (fit.height <= 0) return;
    setMinTop(fit.min);
    setTopPx((current) => {
      const next = dragged.current && current !== null ? clampTo(current, fit.height, fit.max) : fit.height;
      return withRoom(next, fit.min);
    });
  }, [topHidden, fitKey]);

  const moveTo = (px: number) => {
    dragged.current = true;
    setTopPx(withRoom(Math.max(px, minTop), minTop));
  };

  const currentPx = () => topPx ?? boxHeight() * initialRatio;

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    moveTo(e.clientY - rect.top);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowUp: -KEY_STEP, ArrowDown: KEY_STEP }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    moveTo(currentPx() + step * boxHeight());
  };

  return (
    <div className="stack-split" ref={box}>
      <div
        className="stack-top"
        ref={topBox}
        style={bottomHidden ? { flexGrow: 1 } : { flexBasis: topPx === null ? `${initialRatio * 100}%` : `${topPx}px` }}
        hidden={topHidden}
      >
        {top}
      </div>
      <div
        className="stack-splitter"
        hidden={topHidden || bottomHidden}
        role="separator"
        aria-orientation="horizontal"
        aria-label={label}
        aria-valuenow={Math.round((currentPx() / (boxHeight() || 1)) * 100)}
        tabIndex={0}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
      />
      <div className="stack-bottom" hidden={bottomHidden}>
        {bottom}
      </div>
    </div>
  );
}
