// The backup and restore windows: what the main window passes to them and gets back.
import type { PlanDatabase } from "../../../shared/domain/databasePlan";
import type { SelectionOrigin } from "../../../shared/domain/selection";
import type { MongoConnection } from "../../connections/domain/connection";
import type { Session } from "../../connections/domain/session";
import type { BackupRequest, RestoreRequest } from "../domain/backupSpec";

export const BACKUP_VIEW = "backup";
export const RESTORE_VIEW = "restore";
/** Same size as the sync's: wide enough for three columns of collections. */
const WINDOW = { width: 820, height: 720, maximizable: true };
export const BACKUP_WINDOW = { title: "Backup", ...WINDOW };
export const RESTORE_WINDOW = { title: "Restaurar backup", ...WINDOW };

/** What the opener passes to a selection window. */
interface WindowData<Request> {
  /** Every registered connection: a closed one is connected (through the opener) when chosen. */
  connections: MongoConnection[];
  /** The open ones. */
  sessions: Session[];
  /** The tree node it was opened on: the default connection, and what to preselect. */
  origin: SelectionOrigin;
  /** What was chosen before "Volver", to choose it again. */
  initial?: Request;
}

/** What "Continuar" hands back: the validated request and what it does to each database. */
interface Choice<Request> {
  request: Request;
  plan: PlanDatabase[];
}

export type BackupWindowData = WindowData<BackupRequest>;
export type BackupChoice = Choice<BackupRequest>;
export type RestoreWindowData = WindowData<RestoreRequest>;
export type RestoreChoice = Choice<RestoreRequest>;
