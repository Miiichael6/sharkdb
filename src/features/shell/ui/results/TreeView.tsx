import { useEffect, useState, type KeyboardEvent, type MouseEvent } from "react";
import { ColumnHeader } from "../../../../shared/ui/ColumnHeader";
import { useColumnWidths } from "../../../../shared/ui/useColumnWidths";
import { useLog } from "../../../../shared/ui/useLog";
import { VirtualList } from "../../../../shared/ui/VirtualList";
import type { DateZone } from "../../domain/bsonFormat";
import { cellText, type TreeColumn, type TreeRow } from "../../domain/resultView";
import { ROW_HEIGHT } from "./layout";
import { TypeIcon } from "./TypeIcon";
import type { ResultTarget } from "./useResultMenu";
import { useTreeRows } from "./useTreeRows";

const INDENT_PX = 16;

const COLUMNS = [
  { id: "key", label: "Key" },
  { id: "value", label: "Value" },
  { id: "type", label: "Type" },
];
const DEFAULT_WIDTHS: Record<string, number> = { key: 320, value: 360, type: 120 };
const defaultWidth = (id: string) => DEFAULT_WIDTHS[id];

/** How long a copied cell stays highlighted. */
const COPIED_FLASH_MS = 600;

interface Props {
  docs: unknown[];
  /** Number of the first document (skip + 1). */
  firstNumber: number;
  zone: DateZone;
  onContextMenu: (e: MouseEvent, target: ResultTarget) => void;
}

/**
 * Robo 3T's Key / Value / Type tree: one numbered row per document, opened level by level. Clicking a
 * cell picks its column; Ctrl+C copies that cell of the selected row.
 */
export function TreeView({ docs, firstNumber, zone, onContextMenu }: Props) {
  const tree = useTreeRows(docs, firstNumber, zone);
  const { widthOf, startResize } = useColumnWidths(defaultWidth);
  const log = useLog();
  const [column, setColumn] = useState<TreeColumn>("value");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_FLASH_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const onKeyDown = (e: KeyboardEvent) => {
    const row = tree.rows[tree.selected];
    if (row && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      e.preventDefault();
      navigator.clipboard
        .writeText(cellText(row, column, docs[row.docIndex], zone))
        .then(() => setCopied(true))
        .catch((err) => log.error("No se pudo copiar al portapapeles", err));
      return;
    }
    tree.onKeyDown(e);
  };

  /** Classes of a cell: the picked column of the selected row is marked (and flashes once copied). */
  const cellClass = (index: number, id: TreeColumn) =>
    index === tree.selected && id === column ? `cell-focus ${copied ? "copied" : ""}` : "";

  const renderRow = (index: number) => {
    const row: TreeRow = tree.rows[index];
    const pick = (id: TreeColumn) => () => setColumn(id);
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
          onContextMenu(e, {
            doc: docs[row.docIndex],
            path: row.path,
            value: row.raw,
            tree: { expandable: row.expandable, expand: () => tree.expandAll(row), collapse: () => tree.collapseAll(row) },
          });
        }}
      >
        <div
          className={`grid-cell tree-key ${row.depth === 0 ? "tree-doc" : ""} ${cellClass(index, "key")}`}
          role="gridcell"
          onClick={pick("key")}
          // Indent guides are drawn across the padding, one per level.
          style={{ width: widthOf("key"), paddingLeft: row.depth * INDENT_PX, backgroundSize: `${row.depth * INDENT_PX}px 100%` }}
        >
          <span
            className={`twisty ${row.expanded ? "open" : ""}`}
            aria-hidden
            onClick={(e) => {
              e.stopPropagation();
              if (row.expandable) tree.toggle(row.id);
            }}
          >
            {row.expandable && (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path d="M3 1.5 6.5 5 3 8.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            )}
          </span>
          <TypeIcon type={row.type} />
          <span className="tree-key-text" title={row.key}>
            {row.key}
          </span>
        </div>
        <div
          className={`grid-cell tree-value bson-${row.type} ${cellClass(index, "value")}`}
          role="gridcell"
          style={{ width: widthOf("value") }}
          title={row.value}
          onClick={pick("value")}
        >
          {row.value}
        </div>
        <div className={`grid-cell tree-type ${cellClass(index, "type")}`} role="gridcell" style={{ width: widthOf("type") }} onClick={pick("type")}>
          {row.typeLabel}
        </div>
      </div>
    );
  };

  return (
    <VirtualList
      className="result-grid fit-columns"
      role="treegrid"
      ariaLabel="Resultado en árbol"
      count={tree.rows.length}
      rowHeight={ROW_HEIGHT}
      renderRow={renderRow}
      activeIndex={tree.selected}
      onKeyDown={onKeyDown}
      header={<ColumnHeader columns={COLUMNS} widthOf={widthOf} onResizeStart={startResize} />}
    />
  );
}
