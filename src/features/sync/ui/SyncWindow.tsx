import type { CollectionResult } from "../../../shared/domain/jobs";
import type { Session } from "../../connections/domain/session";
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

/** What the sync window hands back once a sync finished. */
export interface SyncWindowResult {
  results: CollectionResult[];
  /** The destination connection and how many of its databases were synced. */
  target: { sid: string; databases: number };
}

/** The sync window: runs the sync itself and reports the outcome to the window that opened it. */
export function SyncWindow({ data, onDone }: { data: SyncWindowData; onDone: (result: SyncWindowResult | null) => void }) {
  return (
    <SyncDialog
      sessions={data.sessions}
      origin={data.origin}
      onDone={(results, target) => onDone({ results, target })}
      onClose={() => onDone(null)}
    />
  );
}
