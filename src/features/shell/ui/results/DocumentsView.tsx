import { ContextMenu } from "../../../../shared/ui/ContextMenu";
import type { DateZone } from "../../domain/bsonFormat";
import type { ViewMode } from "../../domain/resultView";
import { TableView } from "./TableView";
import { TextView } from "./TextView";
import { TreeView } from "./TreeView";
import { useCopyMenu } from "./useCopyMenu";

interface Props {
  docs: unknown[];
  firstNumber: number;
  mode: ViewMode;
  zone: DateZone;
}

/** A page of documents in the chosen view, with the copy menu on right click. */
export function DocumentsView({ docs, firstNumber, mode, zone }: Props) {
  const copyMenu = useCopyMenu(zone);
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
