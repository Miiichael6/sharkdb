import { useState } from "react";
import { useServices } from "../../../app/services";
import type { DocumentTarget, TargetWhere } from "../../../shared/domain/documentTarget";
import { WhereBar } from "../../connections/ui/WhereBar";
import type { StoredDocument } from "../../../shared/ui/documentActions";
import { formatValue, type DateZone } from "../../shell/domain/bsonFormat";
import { ZoneToggle } from "../../shell/ui/results/ZoneToggle";
import { DocumentEditorDialog, type EditorMode } from "./DocumentEditorDialog";

export const DOCUMENT_EDITOR_VIEW = "document-editor";

/** What the opener passes to the editor window. */
export interface DocumentEditorData {
  mode: EditorMode;
  target: DocumentTarget;
  /** Connection, database and collection of `target`, shown over the editor. */
  where: TargetWhere;
  initial: string;
  /** The document being edited, to keep its `_id` (edit), or shown (view). */
  original?: StoredDocument;
  /** Zone the viewed document's dates start in (view only; editing is always in UTC). */
  zone?: DateZone;
}

/** What the editor window hands back once it saved: the stored document when it was an edit. */
export interface DocumentEditorResult {
  saved?: StoredDocument;
}

/** The editor window: saves through the services itself, so a failed save keeps it open with the error. */
export function DocumentEditorWindow({
  data,
  onDone,
}: {
  data: DocumentEditorData;
  onDone: (result: DocumentEditorResult | null) => void;
}) {
  const { documents } = useServices();
  const { mode, target, where, initial, original } = data;
  const [zone, setZone] = useState<DateZone>(data.zone ?? "utc");
  // Viewing, the text follows the zone switch; it is read-only, so nothing typed is lost.
  const viewing = mode === "view" && original;
  return (
    <DocumentEditorDialog
      mode={mode}
      where={<WhereBar where={where} className="document-where" />}
      initial={viewing ? formatValue(original, zone) : initial}
      footer={viewing && <ZoneToggle zone={zone} onChange={setZone} />}
      onSave={async (doc) => {
        if (mode === "edit") {
          onDone({ saved: await documents.replaceDocument(target, original!, doc) });
        } else if (mode === "insert") {
          await documents.insertDocument(target, doc);
          onDone({});
        }
      }}
      onClose={() => onDone(null)}
    />
  );
}
