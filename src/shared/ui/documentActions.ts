// Document actions (view, edit, insert, delete) that the results viewer and the explorer offer
// without depending on the documents feature: it provides them through this context.
import { createContext, useContext } from "react";
import type { DocumentTarget } from "../domain/documentTarget";

/** A document as canonical Extended JSON. */
export type StoredDocument = Record<string, unknown>;

/** One value of a document edited in place: the field at `path` goes from `before` to `after`. */
export interface FieldEdit {
  doc: StoredDocument;
  path: string[];
  before: unknown;
  after: unknown;
}

/** What became of an inline edit: written (with the document as stored), cancelled in the confirmation, or failed (logged). */
export type FieldEditOutcome = { saved: StoredDocument } | "cancelled" | "failed";

/** Each action asks the user (editor or confirmation) and calls `onDone` once something changed. */
export interface DocumentActions {
  /** Shows the document with its dates in `zone` at first (it can be switched there). */
  view(target: DocumentTarget, doc: StoredDocument, zone: "utc" | "local"): void;
  /** `onDone` receives the document as it was stored. */
  edit(target: DocumentTarget, doc: StoredDocument, onDone: (saved: StoredDocument) => void): void;
  /** Asks with the field's before and after, then writes only that field. */
  editField(target: DocumentTarget, edit: FieldEdit): Promise<FieldEditOutcome>;
  insert(target: DocumentTarget, onDone: () => void): void;
  remove(target: DocumentTarget, docs: StoredDocument[], onDone: () => void): void;
  removeAll(target: DocumentTarget, onDone: () => void): void;
}

export const DocumentActionsContext = createContext<DocumentActions | null>(null);

export function useDocumentActions(): DocumentActions {
  const actions = useContext(DocumentActionsContext);
  if (!actions) throw new Error("useDocumentActions must be used inside <DocumentActionsProvider>");
  return actions;
}
