import { useCallback } from "react";
import { useServices } from "../../../app/services";
import type { DangerAnswer } from "../../../shared/domain/confirmation";
import type { DocumentTarget } from "../../../shared/domain/documentTarget";
import { selectThenAsk } from "../../../shared/ui/confirmInWindow";
import { openModalWindow } from "../../../shared/ui/modalWindow";
import type { MongoConnection } from "../../connections/domain/connection";
import type { BorrowedSession, Session } from "../../connections/domain/session";
import { connectOnRequest } from "../../connections/ui/connectOnRequest";
import { DOCUMENTS_REQUIRED, NO_ID, documentIds, documentSyncConfirmation, type DocumentSyncRequest } from "../domain/documentSync";
import {
  DOCUMENT_SYNC_CONFIRM_VIEW,
  DOCUMENT_SYNC_CONFIRM_WINDOW,
  DOCUMENT_SYNC_VIEW,
  DOCUMENT_SYNC_WINDOW,
  type DocumentSyncWindowData,
} from "./documentSyncViews";

interface Options {
  connections: MongoConnection[];
  sessions: Session[];
  /** Lends connection `id`: its session when it's open, otherwise one opened apart. */
  borrowSession: (id: string) => Promise<BorrowedSession>;
  /** Why nothing can be written to `targetId` now (another operation writes there), if so. */
  busyReason: (targetId: string) => string | undefined;
  /** Runs the confirmed sync in the background; settles when it ends. */
  run: (request: DocumentSyncRequest) => Promise<unknown> | undefined;
}

/**
 * The document sync in two windows (R97–R99): the destination, then every document whole, read again
 * from the source, with `confirmo`. "Volver" reopens the destination; only "Sincronizar" starts anything.
 */
export function useDocumentSyncFlow({ connections, sessions, borrowSession, busyReason, run }: Options) {
  const { sync } = useServices();
  return useCallback(
    async (source: DocumentTarget, docs: unknown[]) => {
      if (!docs.length) throw DOCUMENTS_REQUIRED;
      const ids = documentIds(docs);
      if (!ids) throw NO_ID;
      const opened = connectOnRequest(sessions, borrowSession);
      let settled: Promise<unknown> | undefined;
      try {
        const select = (previous?: DocumentSyncRequest) => {
          const data: DocumentSyncWindowData = { connections, sessions: opened.sessions(), source, ids, initialTargetSid: previous?.targetSid };
          return openModalWindow<DocumentSyncRequest>(DOCUMENT_SYNC_VIEW, data, { ...DOCUMENT_SYNC_WINDOW, onRequest: opened.connect });
        };
        const ask = async (request: DocumentSyncRequest) => {
          const confirmation = documentSyncConfirmation(
            request,
            connections,
            await sync.loadFullDocuments(request),
            busyReason(request.targetSid),
          );
          return openModalWindow<DangerAnswer>(DOCUMENT_SYNC_CONFIRM_VIEW, confirmation, {
            ...DOCUMENT_SYNC_CONFIRM_WINDOW,
            title: confirmation.title,
          });
        };
        const request = await selectThenAsk(select, ask);
        if (request) settled = run(request);
      } finally {
        // What the windows borrowed is given back once the operation ends (or when nothing runs).
        void Promise.resolve(settled).finally(opened.release);
      }
    },
    [connections, sessions, borrowSession, busyReason, run, sync],
  );
}
