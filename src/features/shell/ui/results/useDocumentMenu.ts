import type { DocumentTarget } from "../../../../shared/domain/documentTarget";
import { useDocumentActions, type StoredDocument } from "../../../../shared/ui/documentActions";
import type { CursorPager } from "../../application/cursorPager";
import { resultItem, type DocumentEntries, type ResultTarget } from "./useResultMenu";

const NO_ENTRIES: DocumentEntries = { manage: [], remove: [] };

/**
 * "Ver / Editar / Insertar / Eliminar documento" entries for a document of a cursor result.
 * Saved and deleted documents change in place on the page; the script is not run again,
 * since it may write.
 */
export function useDocumentMenu(target: DocumentTarget | null, pager: CursorPager, reload: () => void) {
  const actions = useDocumentActions();

  return ({ doc }: ResultTarget): DocumentEntries => {
    if (!target) return NO_ENTRIES;
    const original = doc as StoredDocument;
    const update = (next: StoredDocument | null) => {
      pager.replace(original, next);
      reload();
    };
    return {
      manage: [
        resultItem("view", "Ver documento…", () => actions.view(target, original)),
        resultItem("edit", "Editar documento…", () => actions.edit(target, original, update)),
        resultItem("insert", "Insertar documento…", () => actions.insert(target, reload)),
      ],
      remove: [
        resultItem("delete", "Eliminar documento…", () => actions.remove(target, [original], () => update(null)), {
          danger: true,
        }),
      ],
    };
  };
}
