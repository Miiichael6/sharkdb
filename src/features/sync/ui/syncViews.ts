// The sync's own window: what the main window passes to it and gets back.
import type { MongoConnection } from "../../connections/domain/connection";
import type { Session } from "../../connections/domain/session";
import type { PlanDatabase, SyncRequest } from "../domain/syncPlan";

export const SYNC_VIEW = "sync";
/** How the selection window opens: wide enough for three columns of collections. */
export const SYNC_WINDOW = { title: "Sincronizar con otro entorno", width: 820, height: 720, maximizable: true };

/** Where the sync window was opened from: the default source, and what to preselect in it. */
export interface SyncOrigin {
  sid: string;
  db?: string;
  collection?: string;
}

/** What the opener passes to the selection window. */
export interface SyncWindowData {
  /** Every registered connection: a closed one is connected (through the opener) when chosen. */
  connections: MongoConnection[];
  /** The open ones. */
  sessions: Session[];
  origin: SyncOrigin;
  /** What was chosen before "Volver", to choose it again. */
  initial?: SyncRequest;
}

/** What "Continuar" hands back: the validated request and what it does to the destination. */
export interface SyncChoice {
  request: SyncRequest;
  plan: PlanDatabase[];
}
