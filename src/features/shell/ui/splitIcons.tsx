// Icons of split tabs: the bar's two columns and where a dragged tab or collection will open.

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinejoin: "round" } as const;

/** A window split in two columns (a split tab in the bar). */
export const COLUMNS_ICON = (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
    <rect x="1" y="1.5" width="10" height="9" rx="1.6" {...stroke} />
    <path d="M6 1.5v9" {...stroke} />
  </svg>
);

/** A window with its left (`side` 0) or right (1) half filled: where a dropped tab opens. */
export function PaneSideIcon({ side }: { side: 0 | 1 }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden>
      <rect x="1.5" y="2" width="12" height="11" rx="2" {...stroke} />
      <rect x={side === 0 ? 2.5 : 7.5} y="3" width="5" height="9" rx="1" fill="currentColor" />
    </svg>
  );
}

/** A window with a plus: dropped, it opens in a tab of its own. */
export const NEW_TAB_ICON = (
  <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden>
    <rect x="1.5" y="2" width="12" height="11" rx="2" {...stroke} />
    <path d="M7.5 5v5M5 7.5h5" {...stroke} strokeLinecap="round" />
  </svg>
);
