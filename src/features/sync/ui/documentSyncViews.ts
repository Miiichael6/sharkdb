// The document sync's own windows: what the main window passes to them and gets back.
import type { DocumentTarget } from "../../../shared/domain/documentTarget";
import type { MongoConnection } from "../../connections/domain/connection";
import type { Session } from "../../connections/domain/session";

export const DOCUMENT_SYNC_VIEW = "document-sync";
export const DOCUMENT_SYNC_WINDOW = { title: "Sincronizar documentos con otro entorno", width: 620, height: 300 };

export const DOCUMENT_SYNC_CONFIRM_VIEW = "document-sync-confirm";
export const DOCUMENT_SYNC_CONFIRM_WINDOW = { width: 760, height: 680, minHeight: 420, maximizable: true };

/** What the opener passes to the selection window. */
export interface DocumentSyncWindowData {
  /** Every registered connection: a closed destination is connected (through the opener) when chosen. */
  connections: MongoConnection[];
  /** The open ones. */
  sessions: Session[];
  /** Fixed source: the viewer's connection, database and collection. */
  source: DocumentTarget;
  /** `_id` of each picked document. */
  ids: unknown[];
  /** The destination chosen before "Volver". */
  initialTargetSid?: string;
}
