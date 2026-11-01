// Which columns of a wide grid fall in the visible strip, so a row only mounts those.

export interface ColumnWindow {
  /** First column drawn. */
  first: number;
  /** One past the last column drawn. */
  end: number;
  /** Width of the columns skipped on the left, and on the right. */
  before: number;
  after: number;
}

/**
 * The columns (by `widths`, laid out from `offset`) that touch the strip from `left` to `left + width`.
 * Starts and ends are inclusive, so a column just touching the edge is still drawn.
 */
export function columnWindow(widths: number[], offset: number, left: number, width: number): ColumnWindow {
  const right = left + width;
  let x = offset;
  let first = widths.length;
  let end = widths.length;
  let before = 0;
  for (let i = 0; i < widths.length; i++) {
    const next = x + widths[i];
    if (first === widths.length && next >= left) {
      first = i;
      before = x - offset;
    }
    if (x > right) {
      end = i;
      break;
    }
    x = next;
  }
  let after = 0;
  for (let i = end; i < widths.length; i++) after += widths[i];
  if (first > end) first = end;
  return { first, end, before, after };
}
