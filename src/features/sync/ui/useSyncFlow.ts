import { useCallback } from "react";
import type { SelectionOrigin } from "../../../shared/domain/selection";
import { selectThenConfirm } from "../../../shared/ui/confirmInWindow";
import { openModalWindow } from "../../../shared/ui/modalWindow";
import type { MongoConnection } from "../../connections/domain/connection";
import { connectionEndpoint } from "../../connections/domain/endpoints";
import type { BorrowedSession, Session } from "../../connections/domain/session";
import { connectOnRequest } from "../../connections/ui/connectOnRequest";
import { syncConfirmation, type SyncRequest } from "../domain/syncPlan";
import { SYNC_VIEW, SYNC_WINDOW, type SyncChoice } from "./syncViews";

interface Options {
  connections: MongoConnection[];
  sessions: Session[];
  /** Lends connection `id`: its session when it's open, otherwise one opened apart. */
  borrowSession: (id: string) => Promise<BorrowedSession>;
  /** Why nothing can be written to `targetId` now (another operation writes there), if so. */
  busyReason: (targetId: string) => string | undefined;
  /** Runs the confirmed sync in the background; settles when it ends. */
  run: (request: SyncRequest) => Promise<unknown> | undefined;
}

/**
 * The sync in two windows (R39): the selection, then "Se va a MODIFICAR" with the confirmation word.
 * "Volver" reopens the selection with what was chosen; only "Sincronizar" starts anything.
 */
export function useSyncFlow({ connections, sessions, borrowSession, busyReason, run }: Options) {
  return useCallback(
    async (origin: SelectionOrigin) => {
      const opened = connectOnRequest(sessions, borrowSession);
      let settled: Promise<unknown> | undefined;
      try {
        const choice = await selectThenConfirm<SyncChoice>(
          (previous) =>
            openModalWindow(
              SYNC_VIEW,
              { connections, sessions: opened.sessions(), origin, initial: previous?.request },
              { ...SYNC_WINDOW, onRequest: opened.connect },
            ),
          ({ request, plan }) =>
            syncConfirmation(
              plan,
              connectionEndpoint(connections, request.sourceSid).name,
              connectionEndpoint(connections, request.targetSid),
              busyReason(request.targetSid),
            ),
        );
        if (choice) settled = run(choice.request);
      } finally {
        // What the windows borrowed is given back once the operation ends (or when nothing runs).
        void Promise.resolve(settled).finally(opened.release);
      }
    },
    [connections, sessions, borrowSession, busyReason, run],
  );
}
