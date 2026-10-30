import { useServices } from "../../../app/services";
import type { DocumentTarget } from "../../../shared/domain/documentTarget";
import type { StoredDocument } from "../../../shared/ui/documentActions";
import { DocumentEditorDialog, type EditorMode } from "./DocumentEditorDialog";

export const DOCUMENT_EDITOR_VIEW = "document-editor";

/** What the opener passes to the editor window. */
export interface DocumentEditorData {
  mode: EditorMode;
  target: DocumentTarget;
  initial: string;
  /** The document being edited, to keep its `_id` (edit only). */
  original?: StoredDocument;
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
  const { mode, target, initial, original } = data;
  return (
    <DocumentEditorDialog
      mode={mode}
      initial={initial}
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
