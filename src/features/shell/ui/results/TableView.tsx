import { useMemo, type KeyboardEvent, type MouseEvent } from "react";
import { ColumnHeader } from "../../../../shared/ui/ColumnHeader";
import { useColumnWidths } from "../../../../shared/ui/useColumnWidths";
import { columnWindow } from "../../../../shared/domain/columnWindow";
import { VirtualList, type Strip } from "../../../../shared/ui/VirtualList";
import { summarizeValue, type DateZone } from "../../domain/bsonFormat";
import { bsonValue } from "../../domain/bsonValue";
import { lookup, tableColumns } from "../../domain/resultView";
import { ROW_HEIGHT } from "./layout";
import { DELETE_DOCUMENT_KEY } from "./useDocumentMenu";
import { useDocumentPick } from "./useDocumentPick";
import type { ResultTarget } from "./useResultMenu";

const NUMBER_COLUMN = { id: "#", label: "#" };
const NUMBER_WIDTH = 56;
const COLUMN_WIDTH = 180;
/** Width drawn past each side of the visible strip, so sideways scrolling doesn't show blanks. */
const OVERSCAN_PX = 400;
const defaultWidth =(id: string) => (id === NUMBER_COLUMN.id ? NUMBER_WIDTH : COLUMN_WIDTH);

interface Props {
  docs: unknown[];
  firstNumber: number;
  zone: DateZone;
  onContextMenu: (e: MouseEvent, target: ResultTarget) => void;
  /** Delete key: deletes the picked documents. */
  onDeleteDocuments?: (docs: unknown[]) => void;
}

/**
 * One row per document and one column per field (embedded documents spread as `a.b`). Rows are picked with
 * click, Ctrl/Shift+click, dragging or Ctrl+A, and Delete deletes the picked ones.
 */
export function TableView({ docs, firstNumber, zone, onContextMenu, onDeleteDocuments }: Props) {
  const columns = useMemo(() => tableColumns(docs), [docs]);
  const { widthOf, startResize } = useColumnWidths(defaultWidth);
  const docPick = useDocumentPick(docs);

  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      docPick.pickAll();
      return;
    }
    if (e.key !== DELETE_DOCUMENT_KEY || !onDeleteDocuments || !docPick.picked.size) return;
    e.preventDefault();
    onDeleteDocuments(docPick.pickedDocs());
  };

  const renderRow = (index: number, strip: Strip) => {
    const doc = docs[index];
    const isPicked = docPick.picked.has(index);
    const { first, end, before, after } = columnWindow(
      columns.map((c) => widthOf(c.id)),
      widthOf(NUMBER_COLUMN.id),
      strip.left - OVERSCAN_PX,
      strip.width + 2 * OVERSCAN_PX,
    );
    return (
      <div
        key={index}
        role="row"
        aria-selected={isPicked}
        className={`grid-row ${isPicked ? "selected" : ""}`}
        style={{ height: ROW_HEIGHT }}
        onMouseDown={(e) => docPick.press(index, e)}
        onMouseEnter={() => docPick.dragOver(index)}
      >
        <div className="grid-cell muted" role="rowheader" style={{ width: widthOf(NUMBER_COLUMN.id) }}>
          {firstNumber + index}
        </div>
        {before > 0 && <div style={{ width: before, flex: "none" }} />}
        {columns.slice(first, end).map((c) => {
          const found = lookup(doc, c.path);
          const text = found ? summarizeValue(found.value, zone) : "";
          return (
            <div
              key={c.id}
              role="gridcell"
              className={`grid-cell ${found ? `bson-${bsonValue(found.value).type}` : ""}`}
              style={{ width: widthOf(c.id) }}
              title={text}
              onContextMenu={(e) => {
                onContextMenu(e, {
                  doc,
                  docs: docPick.targetsOf(index),
                  path: found ? c.path : [],
                  value: found ? found.value : doc,
                });
              }}
            >
              {text}
            </div>
          );
        })}
        {after > 0 && <div style={{ width: after, flex: "none" }} />}
      </div>
    );
  };

  return (
    <VirtualList
      className="result-grid"
      role="grid"
      ariaLabel="Resultado en tabla"
      count={docs.length}
      rowHeight={ROW_HEIGHT}
      renderRow={renderRow}
      activeIndex={docPick.anchor}
      onKeyDown={onKeyDown}
      header={<ColumnHeader columns={[NUMBER_COLUMN, ...columns]} widthOf={widthOf} onResizeStart={startResize} />}
    />
  );
}
