import { useMemo, useState, type MouseEvent } from "react";
import { ColumnHeader } from "../../../../shared/ui/ColumnHeader";
import { useColumnWidths } from "../../../../shared/ui/useColumnWidths";
import { VirtualList } from "../../../../shared/ui/VirtualList";
import { summarizeValue, type DateZone } from "../../domain/bsonFormat";
import { bsonValue } from "../../domain/bsonValue";
import { lookup, tableColumns } from "../../domain/resultView";
import { ROW_HEIGHT } from "./layout";
import type { ResultTarget } from "./useResultMenu";

const NUMBER_COLUMN = { id: "#", label: "#" };
const NUMBER_WIDTH = 56;
const COLUMN_WIDTH = 180;
const defaultWidth = (id: string) => (id === NUMBER_COLUMN.id ? NUMBER_WIDTH : COLUMN_WIDTH);

interface Props {
  docs: unknown[];
  firstNumber: number;
  zone: DateZone;
  onContextMenu: (e: MouseEvent, target: ResultTarget) => void;
}

/** One row per document and one column per field (embedded documents spread as `a.b`). */
export function TableView({ docs, firstNumber, zone, onContextMenu }: Props) {
  const columns = useMemo(() => tableColumns(docs), [docs]);
  const { widthOf, startResize } = useColumnWidths(defaultWidth);
  const [selected, setSelected] = useState(-1);

  const renderRow = (index: number) => {
    const doc = docs[index];
    return (
      <div
        key={index}
        role="row"
        aria-selected={index === selected}
        className={`grid-row ${index === selected ? "selected" : ""}`}
        style={{ height: ROW_HEIGHT }}
        onClick={() => setSelected(index)}
      >
        <div className="grid-cell muted" role="rowheader" style={{ width: widthOf(NUMBER_COLUMN.id) }}>
          {firstNumber + index}
        </div>
        {columns.map((c) => {
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
                setSelected(index);
                onContextMenu(e, { doc, path: found ? c.path : [], value: found ? found.value : doc });
              }}
            >
              {text}
            </div>
          );
        })}
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
      header={<ColumnHeader columns={[NUMBER_COLUMN, ...columns]} widthOf={widthOf} onResizeStart={startResize} />}
    />
  );
}
