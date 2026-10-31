import { useCallback } from "react";
import type { DangerConfirmRequest } from "../../../shared/domain/confirmation";
import { confirmDangerInWindow } from "../../../shared/ui/confirmInWindow";
import { openModalWindow } from "../../../shared/ui/modalWindow";
import { displayName, type MongoConnection } from "../../connections/domain/connection";
import type { Session } from "../../connections/domain/session";
import { syncConfirmation, type SyncRequest } from "../domain/syncPlan";
import { SYNC_VIEW, SYNC_WINDOW, type SyncChoice, type SyncOrigin } from "./syncViews";

interface Options {
  connections: MongoConnection[];
  sessions: Session[];
  /** Opens connection `id` in the main window (or returns its session when it's open). */
  ensureSession: (id: string) => Promise<Session>;
  /** Why nothing can be written to `targetId` now (another operation writes there), if so. */
  busyReason: (targetId: string) => string | undefined;
  /** Runs the confirmed sync in the background. */
  run: (request: SyncRequest) => void;
}

/**
 * The sync in two windows (R39): the selection, then "Se va a MODIFICAR" with the confirmation word.
 * "Volver" reopens the selection with what was chosen; only "Sincronizar" starts anything.
 */
export function useSyncFlow({ connections, sessions, ensureSession, busyReason, run }: Options) {
  return useCallback(
    async (origin: SyncOrigin) => {
      // The selection window may connect closed connections; reopening it after "Volver" must know them.
      let open = sessions;
      const connect = async (id: unknown) => {
        const session = await ensureSession(String(id));
        open = [...open.filter((s) => s.conn.id !== session.conn.id), session];
        return session;
      };
      const endpoint = (id: string) => {
        const conn = connections.find((c) => c.id === id);
        return conn ? { name: displayName(conn), tag: conn.tag } : { name: id };
      };
      const confirmation = ({ request, plan }: SyncChoice): DangerConfirmRequest =>
        syncConfirmation(plan, endpoint(request.sourceSid).name, endpoint(request.targetSid), busyReason(request.targetSid));

      let initial: SyncRequest | undefined;
      for (;;) {
        const data = { connections, sessions: open, origin, initial };
        const choice = await openModalWindow<SyncChoice>(SYNC_VIEW, data, { ...SYNC_WINDOW, onRequest: connect });
        if (!choice) return;
        const answer = await confirmDangerInWindow(confirmation(choice));
        if (answer === "confirm") return run(choice.request);
        if (answer !== "back") return;
        initial = choice.request;
      }
    },
    [connections, sessions, ensureSession, busyReason, run],
  );
}
