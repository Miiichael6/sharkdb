import { ContextMenu } from "../../../../shared/ui/ContextMenu";
import type { DateZone } from "../../domain/bsonFormat";
import type { ViewMode } from "../../domain/resultView";
import { TableView } from "./TableView";
import { TextView } from "./TextView";
import { TreeView } from "./TreeView";
import type { InlineEditing } from "./useFieldEdit";
import { useResultMenu, type DocumentEntries, type ResultTarget } from "./useResultMenu";

interface Props {
  docs: unknown[];
  firstNumber: number;
  mode: ViewMode;
  zone: DateZone;
  /** Entries added to the copy menu for the clicked document. */
  documentMenu?: (target: ResultTarget) => DocumentEntries;
  /** Delete key on the picked documents (tree and table views). */
  onDeleteDocuments?: (docs: unknown[]) => void;
  /** Editing values in place, in the tree view only (D21). */
  inlineEditing?: InlineEditing;
}

/** A page of documents in the chosen view, with the result menu on right click. */
export function DocumentsView({ docs, firstNumber, mode, zone, documentMenu, onDeleteDocuments, inlineEditing }: Props) {
  const copyMenu = useResultMenu(zone, documentMenu);
  const props = { docs, firstNumber, zone };

  return (
    <div className="documents-view">
      {mode === "tree" && <TreeView {...props} onContextMenu={copyMenu.open} onDeleteDocuments={onDeleteDocuments} inlineEditing={inlineEditing} />}
      {mode === "table" && <TableView {...props} onContextMenu={copyMenu.open} onDeleteDocuments={onDeleteDocuments} />}
      {mode === "text" && <TextView {...props} />}
      {copyMenu.menu && <ContextMenu {...copyMenu.menu} onClose={copyMenu.close} />}
    </div>
  );
}
