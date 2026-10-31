// The sync's own window: what the main window passes to it and gets back.
import type { PlanDatabase } from "../../../shared/domain/databasePlan";
import type { SelectionOrigin } from "../../../shared/domain/selection";
import type { MongoConnection } from "../../connections/domain/connection";
import type { Session } from "../../connections/domain/session";
import type { SyncRequest } from "../domain/syncPlan";

export const SYNC_VIEW = "sync";
/** How the selection window opens: wide enough for three columns of collections. */
export const SYNC_WINDOW = { title: "Sincronizar con otro entorno", width: 820, height: 720, maximizable: true };

/** What the opener passes to the selection window. */
export interface SyncWindowData {
  /** Every registered connection: a closed one is connected (through the opener) when chosen. */
  connections: MongoConnection[];
  /** The open ones. */
  sessions: Session[];
  /** The default source, and what to preselect in it. */
  origin: SelectionOrigin;
  /** What was chosen before "Volver", to choose it again. */
  initial?: SyncRequest;
}

/** What "Continuar" hands back: the validated request and what it does to the destination. */
export interface SyncChoice {
  request: SyncRequest;
  plan: PlanDatabase[];
}
