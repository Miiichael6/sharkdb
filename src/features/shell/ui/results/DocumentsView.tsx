import { ContextMenu, type ContextMenuItem } from "../../../../shared/ui/ContextMenu";
import type { DateZone } from "../../domain/bsonFormat";
import type { ViewMode } from "../../domain/resultView";
import { TableView } from "./TableView";
import { TextView } from "./TextView";
import { TreeView } from "./TreeView";
import { useCopyMenu, type CopyTarget } from "./useCopyMenu";

interface Props {
  docs: unknown[];
  firstNumber: number;
  mode: ViewMode;
  zone: DateZone;
  /** Entries added to the copy menu for the clicked document. */
  documentMenu?: (target: CopyTarget) => ContextMenuItem[];
}

/** A page of documents in the chosen view, with the copy (and document) menu on right click. */
export function DocumentsView({ docs, firstNumber, mode, zone, documentMenu }: Props) {
  const copyMenu = useCopyMenu(zone, documentMenu);
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
