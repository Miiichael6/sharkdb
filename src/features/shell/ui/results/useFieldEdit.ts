import type { DocumentTarget } from "../../../../shared/domain/documentTarget";
import { useDocumentActions, type FieldEdit, type FieldEditOutcome, type StoredDocument } from "../../../../shared/ui/documentActions";
import { useReadOnly } from "../../../connections/ui/useReadOnly";
import type { CursorPager } from "../../application/cursorPager";

/** Shown when a value is opened for editing while the session can't write. */
const READ_ONLY_HINT = "Safe mode activo: la sesión es de solo lectura y no se pueden editar valores";

/** What the tree needs to edit values in place: whether it can write now, and how to save. */
export interface InlineEditing {
  /** Why values can't be edited right now (safe mode, also on protected connections), or null. */
  blocked: string | null;
  save: (edit: FieldEdit) => Promise<FieldEditOutcome>;
}

/**
 * Inline editing of a cursor result's values: only on whole documents of a collection (not a
 * projection or an aggregate). A saved value changes the document in place on the page, as the
 * document editor does; the script is not run again.
 */
export function useFieldEdit(target: DocumentTarget | null, pager: CursorPager, reload: () => void): InlineEditing | undefined {
  const actions = useDocumentActions();
  const isReadOnly = useReadOnly();
  if (!target || !pager.editable) return undefined;

  const save = async (edit: FieldEdit) => {
    const outcome = await actions.editField(target, edit);
    if (typeof outcome === "object") {
      pager.replace(edit.doc as StoredDocument, outcome.saved);
      reload();
    }
    return outcome;
  };
  return { blocked: isReadOnly(target.sid) ? READ_ONLY_HINT : null, save };
}
