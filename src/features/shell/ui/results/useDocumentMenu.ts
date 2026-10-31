import type { DocumentTarget } from "../../../../shared/domain/documentTarget";
import { useDocumentActions, type StoredDocument } from "../../../../shared/ui/documentActions";
import { useReadOnly } from "../../../connections/ui/useReadOnly";
import type { CursorPager } from "../../application/cursorPager";
import type { DateZone } from "../../domain/bsonFormat";
import { resultItem, type DocumentEntries, type ResultTarget } from "./useResultMenu";

const NO_ENTRIES: DocumentEntries = { manage: [], remove: [] };

/** Key that deletes the picked documents, also shown next to "Eliminar documento…". */
export const DELETE_DOCUMENT_KEY = "Delete";
const DELETE_DOCUMENT_HINT = "Supr";

/**
 * "Ver / Editar / Insertar / Eliminar documento" entries for a document of a cursor result, plus the
 * deletion of the picked documents the Delete key runs. Saved and deleted documents change in place on the page; the script is
 * not run again, since it may write. While the session is in safe mode only "Ver" stays enabled.
 */
export function useDocumentMenu(target: DocumentTarget | null, pager: CursorPager, reload: () => void, zone: DateZone) {
  const actions = useDocumentActions();
  const isReadOnly = useReadOnly();

  const replace = (original: StoredDocument, next: StoredDocument | null) => {
    pager.replace(original, next);
    reload();
  };

  /** Asks once in the red window and deletes `docs`; does nothing in safe mode or outside a collection. */
  const removeDocuments = (docs: unknown[]) => {
    if (!target || isReadOnly(target.sid) || !docs.length) return;
    const originals = docs as StoredDocument[];
    actions.remove(target, originals, () => {
      for (const original of originals) pager.replace(original, null);
      reload();
    });
  };

  const entries = ({ doc, docs }: ResultTarget): DocumentEntries => {
    if (!target) return NO_ENTRIES;
    const write = { disabled: isReadOnly(target.sid) };
    const original = doc as StoredDocument;
    const update = (next: StoredDocument | null) => replace(original, next);
    return {
      manage: [
        resultItem("view", "Ver documento…", () => actions.view(target, original, zone)),
        resultItem("edit", "Editar documento…", () => actions.edit(target, original, update), write),
        resultItem("insert", "Insertar documento…", () => actions.insert(target, reload), write),
      ],
      remove: [
        resultItem("delete", docs.length > 1 ? `Eliminar ${docs.length} documentos…` : "Eliminar documento…", () => removeDocuments(docs), {
          ...write,
          danger: true,
          hint: DELETE_DOCUMENT_HINT,
        }),
      ],
    };
  };

  return { entries, removeDocuments };
}
