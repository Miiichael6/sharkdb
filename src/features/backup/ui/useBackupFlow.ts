import { useCallback } from "react";
import type { SelectionOrigin } from "../../../shared/domain/selection";
import { selectThenConfirm } from "../../../shared/ui/confirmInWindow";
import { openModalWindow } from "../../../shared/ui/modalWindow";
import type { MongoConnection } from "../../connections/domain/connection";
import { connectionEndpoint } from "../../connections/domain/endpoints";
import type { BorrowedSession, Session } from "../../connections/domain/session";
import { connectOnRequest } from "../../connections/ui/connectOnRequest";
import { backupConfirmation, type BackupRequest } from "../domain/backupSpec";
import { BACKUP_VIEW, BACKUP_WINDOW, type BackupChoice } from "./backupViews";

interface Options {
  connections: MongoConnection[];
  sessions: Session[];
  /** Lends connection `id`: its session when it's open, otherwise one opened apart. */
  borrowSession: (id: string) => Promise<BorrowedSession>;
  /** Runs the confirmed backup in the background; settles when it ends. */
  run: (request: BackupRequest) => Promise<unknown> | undefined;
}

/**
 * The backup in two windows, like the sync: the selection, then "Se va a GUARDAR en {carpeta}" with
 * the confirmation word. "Volver" reopens the selection with what was chosen.
 */
export function useBackupFlow({ connections, sessions, borrowSession, run }: Options) {
  return useCallback(
    async (origin: SelectionOrigin) => {
      const opened = connectOnRequest(sessions, borrowSession);
      let settled: Promise<unknown> | undefined;
      try {
        const choice = await selectThenConfirm<BackupChoice>(
          (previous) =>
            openModalWindow(
              BACKUP_VIEW,
              { connections, sessions: opened.sessions(), origin, initial: previous?.request },
              { ...BACKUP_WINDOW, onRequest: opened.connect },
            ),
          ({ request, plan }) => backupConfirmation(plan, connectionEndpoint(connections, request.sid).name, request.dir),
        );
        if (choice) settled = run(choice.request);
      } finally {
        // What the windows borrowed is given back once the operation ends (or when nothing runs).
        void Promise.resolve(settled).finally(opened.release);
      }
    },
    [connections, sessions, borrowSession, run],
  );
}
