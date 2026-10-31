import { useCallback } from "react";
import type { SelectionOrigin } from "../../../shared/domain/selection";
import { selectThenConfirm } from "../../../shared/ui/confirmInWindow";
import { openModalWindow } from "../../../shared/ui/modalWindow";
import type { MongoConnection } from "../../connections/domain/connection";
import { connectionEndpoint } from "../../connections/domain/endpoints";
import type { BorrowedSession, Session } from "../../connections/domain/session";
import { connectOnRequest } from "../../connections/ui/connectOnRequest";
import { restoreConfirmation, type RestoreRequest } from "../domain/backupSpec";
import { RESTORE_VIEW, RESTORE_WINDOW, type RestoreChoice } from "./backupViews";

interface Options {
  connections: MongoConnection[];
  sessions: Session[];
  /** Lends connection `id`: its session when it's open, otherwise one opened apart. */
  borrowSession: (id: string) => Promise<BorrowedSession>;
  /** Why nothing can be written to `targetId` now (another operation writes there), if so. */
  busyReason: (targetId: string) => string | undefined;
  /** Runs the confirmed restore in the background; settles when it ends. */
  run: (request: RestoreRequest) => Promise<unknown> | undefined;
}

/**
 * The restore in two windows, like the sync: the selection, then "Se va a MODIFICAR" with the
 * confirmation word. "Volver" reopens the selection with what was chosen.
 */
export function useRestoreFlow({ connections, sessions, borrowSession, busyReason, run }: Options) {
  return useCallback(
    async (origin: SelectionOrigin) => {
      const opened = connectOnRequest(sessions, borrowSession);
      let settled: Promise<unknown> | undefined;
      try {
        const choice = await selectThenConfirm<RestoreChoice>(
          (previous) =>
            openModalWindow(
              RESTORE_VIEW,
              { connections, sessions: opened.sessions(), origin, initial: previous?.request },
              { ...RESTORE_WINDOW, onRequest: opened.connect },
            ),
          ({ request, plan }) =>
            restoreConfirmation(plan, request.dir, connectionEndpoint(connections, request.targetSid), busyReason(request.targetSid)),
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
