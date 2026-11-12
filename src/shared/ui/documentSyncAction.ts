// "Sincronizar con otro entorno…" for the documents picked in the viewer (R97): the results viewer
// offers it without depending on the sync feature, which provides it through this context.
import { createContext, useContext } from "react";
import type { DocumentTarget } from "../domain/documentTarget";

/** Opens the document sync for `docs` (as the viewer shows them) of `target`'s collection. */
export type SyncDocuments = (target: DocumentTarget, docs: unknown[]) => void;

export const DocumentSyncContext = createContext<SyncDocuments | null>(null);

/** The document sync, or null outside the workspace (e.g. a window of its own), where it isn't offered. */
export const useSyncDocuments = () => useContext(DocumentSyncContext);
