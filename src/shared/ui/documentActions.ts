// Document actions (view, edit, insert, delete) that the results viewer and the explorer offer
// without depending on the documents feature: it provides them through this context.
import { createContext, useContext } from "react";
import type { DocumentTarget } from "../domain/documentTarget";

/** A document as canonical Extended JSON. */
export type StoredDocument = Record<string, unknown>;

/** Each action asks the user (editor or confirmation) and calls `onDone` once something changed. */
export interface DocumentActions {
  /** Shows the document with its dates in `zone` at first (it can be switched there). */
  view(target: DocumentTarget, doc: StoredDocument, zone: "utc" | "local"): void;
  /** `onDone` receives the document as it was stored. */
  edit(target: DocumentTarget, doc: StoredDocument, onDone: (saved: StoredDocument) => void): void;
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
