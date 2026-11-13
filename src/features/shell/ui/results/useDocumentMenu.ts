import type { DocumentTarget } from "../../../../shared/domain/documentTarget";
import { useDocumentActions, type StoredDocument } from "../../../../shared/ui/documentActions";
import { useSyncDocuments } from "../../../../shared/ui/documentSyncAction";
import type { ContextMenuItem } from "../../../../shared/ui/ContextMenu";
import { useReadOnly } from "../../../connections/ui/useReadOnly";
import { documentSyncUnavailable } from "../../../sync/domain/documentSync";
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
 * not run again, since it may write. While the session is in safe mode only "Ver" stays enabled; on a
 * result that isn't whole documents of the collection (projection, aggregate) only "Ver" is offered.
 * "Sincronizar con otro entorno…" is always listed (the documents are read whole by `_id`, R97) but
 * disabled, with the reason, unless the result is whole documents of the collection: not an aggregate
 * (its `_id` may be another), a projection or a view.
 */
export function useDocumentMenu(target: DocumentTarget | null, pager: CursorPager, reload: () => void, zone: DateZone) {
  const actions = useDocumentActions();
  const syncDocuments = useSyncDocuments();
  const isReadOnly = useReadOnly();

  const replace = (original: StoredDocument, next: StoredDocument | null) => {
    pager.replace(original, next);
    reload();
  };

  /** Asks once in the red window and deletes `docs`; does nothing in safe mode, outside a collection or on a result that can't be edited. */
  const removeDocuments = (docs: unknown[]) => {
    if (!target || !pager.editable || isReadOnly(target.sid) || !docs.length) return;
    const originals = docs as StoredDocument[];
    actions.remove(target, originals, () => {
      for (const original of originals) pager.replace(original, null);
      reload();
    });
  };

  /** Disabled, with the reason as its tooltip, when the collection or an `_id` is unknown. */
  const syncEntries = (docs: unknown[]): ContextMenuItem[] => {
    if (!syncDocuments) return [];
    const unavailable = documentSyncUnavailable(target, docs, pager.uneditable);
    const label = docs.length > 1 ? `Sincronizar ${docs.length} documentos con otro entorno…` : "Sincronizar con otro entorno…";
    const sync = () => target && syncDocuments(target, docs);
    return [resultItem("sync", label, sync, unavailable ? { disabled: true, title: unavailable } : {})];
  };

  const entries = ({ doc, docs }: ResultTarget): DocumentEntries => {
    if (!target) return syncDocuments ? { manage: syncEntries(docs), remove: [] } : NO_ENTRIES;
    const write = { disabled: isReadOnly(target.sid) };
    const original = doc as StoredDocument;
    const view = resultItem("view", "Ver documento…", () => actions.view(target, original, zone));
    if (!pager.editable) return { manage: [view, ...syncEntries(docs)], remove: [] };
    const update = (next: StoredDocument | null) => replace(original, next);
    return {
      manage: [
        view,
        resultItem("edit", "Editar documento…", () => actions.edit(target, original, update), write),
        resultItem("insert", "Insertar documento…", () => actions.insert(target, reload), write),
        ...syncEntries(docs),
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
