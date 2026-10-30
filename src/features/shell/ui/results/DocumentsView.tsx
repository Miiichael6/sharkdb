import { ContextMenu } from "../../../../shared/ui/ContextMenu";
import type { DateZone } from "../../domain/bsonFormat";
import type { ViewMode } from "../../domain/resultView";
import { TableView } from "./TableView";
import { TextView } from "./TextView";
import { TreeView } from "./TreeView";
import { useResultMenu, type DocumentEntries, type ResultTarget } from "./useResultMenu";

interface Props {
  docs: unknown[];
  firstNumber: number;
  mode: ViewMode;
  zone: DateZone;
  /** Entries added to the copy menu for the clicked document. */
  documentMenu?: (target: ResultTarget) => DocumentEntries;
}

/** A page of documents in the chosen view, with the result menu on right click. */
export function DocumentsView({ docs, firstNumber, mode, zone, documentMenu }: Props) {
  const copyMenu = useResultMenu(zone, documentMenu);
  const props = { docs, firstNumber, zone };

  return (
    <div className="documents-view">
      {mode === "tree" && <TreeView {...props} onContextMenu={copyMenu.open} />}
      {mode === "table" && <TableView {...props} onContextMenu={copyMenu.open} />}
      {mode === "text" && <TextView {...props} />}
      {copyMenu.menu && <ContextMenu {...copyMenu.menu} onClose={copyMenu.close} />}
    </div>
  );
}
