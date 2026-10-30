import type { MouseEvent } from "react";

interface Props {
  columns: { id: string; label: string }[];
  widthOf: (id: string) => number;
  onResizeStart: (id: string, e: MouseEvent) => void;
}

/** Sticky header row of a grid; dragging a column's right edge resizes it. */
export function ColumnHeader({ columns, widthOf, onResizeStart }: Props) {
  return (
    <div className="grid-header" role="row">
      {columns.map((c) => (
        <div key={c.id} className="grid-cell" role="columnheader" style={{ width: widthOf(c.id) }} title={c.label}>
          {c.label}
          <span className="col-resizer" aria-hidden onMouseDown={(e) => onResizeStart(c.id, e)} />
        </div>
      ))}
    </div>
  );
}
