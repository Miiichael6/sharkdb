import type { Session } from "../../connections/domain/session";
import type { SyncRequest } from "../domain/syncPlan";
import { SyncDialog } from "./SyncDialog";
import type { SyncOrigin } from "./useSyncForm";

export const SYNC_VIEW = "sync";
/** How the sync window opens: wide enough for three columns of collections. */
export const SYNC_WINDOW = { title: "Sincronizar con otro entorno", width: 820, height: 760, maximizable: true };

/** What the opener passes to the sync window. */
export interface SyncWindowData {
  sessions: Session[];
  origin: SyncOrigin;
}

/** The sync window: chooses what to sync and hands the request back to the main window, which runs it. */
export function SyncWindow({ data, onDone }: { data: SyncWindowData; onDone: (request: SyncRequest | null) => void }) {
  return <SyncDialog sessions={data.sessions} origin={data.origin} onDone={onDone} onClose={() => onDone(null)} />;
}
