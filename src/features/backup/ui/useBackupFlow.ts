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

export interface BackupWindowsContext {
  connections: MongoConnection[];
  sessions: Session[];
  /** Lends connection `id`: its session when it's open, otherwise one opened apart. */
  borrowSession: (id: string) => Promise<BorrowedSession>;
}

interface Options extends BackupWindowsContext {
  /** Why no backup can start now (another window has an operation running), if so. */
  busyElsewhere: () => string | undefined;
  /** Runs the confirmed backup in the background; settles when it ends. */
  run: (request: BackupRequest) => Promise<unknown> | undefined;
}

/**
 * The backup in two windows, like the sync: the selection (starting from `initial` when given), then
 * "Se va a GUARDAR en {carpeta}" with the confirmation word. "Volver" reopens the selection with what
 * was chosen. `use` gets the confirmed request; what the windows borrowed is given back once the
 * promise it returns settles. While `blocked` says why, the confirmation can't go ahead.
 */
export async function chooseBackup(
  { connections, sessions, borrowSession }: BackupWindowsContext,
  origin: SelectionOrigin,
  use: (request: BackupRequest) => Promise<unknown> | undefined,
  initial?: BackupRequest,
  blocked: () => string | undefined = () => undefined,
) {
  const opened = connectOnRequest(sessions, borrowSession);
  let settled: Promise<unknown> | undefined;
  try {
    const choice = await selectThenConfirm<BackupChoice>(
      (previous) =>
        openModalWindow(
          BACKUP_VIEW,
          { connections, sessions: opened.sessions(), origin, initial: previous?.request ?? initial },
          { ...BACKUP_WINDOW, onRequest: opened.connect },
        ),
      ({ request, plan }) => backupConfirmation(plan, connectionEndpoint(connections, request.sid).name, request.dir, blocked()),
    );
    if (choice) settled = use(choice.request);
  } finally {
    void Promise.resolve(settled).finally(opened.release);
  }
}

/** The backup windows, then the confirmed backup runs in the background. */
export function useBackupFlow({ connections, sessions, borrowSession, busyElsewhere, run }: Options) {
  return useCallback(
    (origin: SelectionOrigin) => chooseBackup({ connections, sessions, borrowSession }, origin, run, undefined, busyElsewhere),
    [connections, sessions, borrowSession, busyElsewhere, run],
  );
}
