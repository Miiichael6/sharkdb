import type { MouseEvent } from "react";
import { ColumnHeader } from "../../../../shared/ui/ColumnHeader";
import { useColumnWidths } from "../../../../shared/ui/useColumnWidths";
import { VirtualList } from "../../../../shared/ui/VirtualList";
import type { DateZone } from "../../domain/bsonFormat";
import type { TreeRow } from "../../domain/resultView";
import { ROW_HEIGHT } from "./layout";
import { TYPE_ICON } from "./typeIcon";
import type { CopyTarget } from "./useCopyMenu";
import { useTreeRows } from "./useTreeRows";

const INDENT_PX = 16;

const COLUMNS = [
  { id: "key", label: "Key" },
  { id: "value", label: "Value" },
  { id: "type", label: "Type" },
];
const DEFAULT_WIDTHS: Record<string, number> = { key: 320, value: 360, type: 120 };
const defaultWidth = (id: string) => DEFAULT_WIDTHS[id];

interface Props {
  docs: unknown[];
  /** Number of the first document (skip + 1). */
  firstNumber: number;
  zone: DateZone;
  onContextMenu: (e: MouseEvent, target: CopyTarget) => void;
}

/** Robo 3T's Key / Value / Type tree: one numbered row per document, opened level by level. */
export function TreeView({ docs, firstNumber, zone, onContextMenu }: Props) {
  const tree = useTreeRows(docs, firstNumber, zone);
  const { widthOf, startResize } = useColumnWidths(defaultWidth);

  const renderRow = (index: number) => {
    const row: TreeRow = tree.rows[index];
    return (
      <div
        key={row.id}
        role="row"
        aria-level={row.depth + 1}
        aria-expanded={row.expandable ? row.expanded : undefined}
        aria-selected={index === tree.selected}
        className={`grid-row ${index === tree.selected ? "selected" : ""}`}
        style={{ height: ROW_HEIGHT }}
        onClick={() => tree.select(index)}
        onDoubleClick={() => row.expandable && tree.toggle(row.id)}
        onContextMenu={(e) => {
          tree.select(index);
          onContextMenu(e, { doc: docs[row.docIndex], path: row.path, value: row.raw });
        }}
      >
        <div className="grid-cell tree-key" role="gridcell" style={{ width: widthOf("key"), paddingLeft: row.depth * INDENT_PX }}>
          <span
            className="twisty"
            aria-hidden
            onClick={(e) => {
              e.stopPropagation();
              if (row.expandable) tree.toggle(row.id);
            }}
          >
            {row.expandable ? (row.expanded ? "▾" : "▸") : ""}
          </span>
          <span className={`type-icon bson-${row.type}`} aria-hidden>
            {TYPE_ICON[row.type]}
          </span>
          {row.key}
        </div>
        <div className={`grid-cell bson-${row.type}`} role="gridcell" style={{ width: widthOf("value") }} title={row.value}>
          {row.value}
        </div>
        <div className="grid-cell muted" role="gridcell" style={{ width: widthOf("type") }}>
          {row.typeLabel}
        </div>
      </div>
    );
  };

  return (
    <VirtualList
      className="result-grid"
      role="treegrid"
      ariaLabel="Resultado en árbol"
      count={tree.rows.length}
      rowHeight={ROW_HEIGHT}
      renderRow={renderRow}
      activeIndex={tree.selected}
      onKeyDown={tree.onKeyDown}
      header={<ColumnHeader columns={COLUMNS} widthOf={widthOf} onResizeStart={startResize} />}
    />
  );
}
