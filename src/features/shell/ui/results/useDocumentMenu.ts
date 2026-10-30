import type { DocumentTarget } from "../../../../shared/domain/documentTarget";
import type { ContextMenuItem } from "../../../../shared/ui/ContextMenu";
import { useDocumentActions, type StoredDocument } from "../../../../shared/ui/documentActions";
import type { CursorPager } from "../../application/cursorPager";
import type { CopyTarget } from "./useCopyMenu";

/**
 * "Ver / Editar / Insertar / Eliminar documento" entries for a document of a cursor result.
 * Saved and deleted documents change in place on the page; the script is not run again,
 * since it may write.
 */
export function useDocumentMenu(target: DocumentTarget | null, pager: CursorPager, reload: () => void) {
  const actions = useDocumentActions();

  return ({ doc }: CopyTarget): ContextMenuItem[] => {
    if (!target) return [];
    const original = doc as StoredDocument;
    const update = (next: StoredDocument | null) => {
      pager.replace(original, next);
      reload();
    };
    return [
      { label: "Ver documento…", onSelect: () => actions.view(target, original) },
      { label: "Editar documento…", onSelect: () => actions.edit(target, original, update) },
      { label: "Insertar documento…", onSelect: () => actions.insert(target, reload) },
      { label: "Eliminar documento…", onSelect: () => actions.remove(target, [original], () => update(null)) },
    ];
  };
}
