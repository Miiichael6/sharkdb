import { useEffect } from "react";
import type { MongoConnection } from "../../features/connections/domain/connection";
import type { BorrowedSession } from "../../features/connections/domain/session";
import { connectOnRequest } from "../../features/connections/ui/connectOnRequest";
import { RETRY_UNAVAILABLE, type Relaunch, type StartedOperation } from "../../shared/application/operationsService";
import { isDataRequest, retryBlockReason, usedConnections, writtenConnection } from "./dataRequest";
import type { useDataOperations } from "./useDataOperations";
import { useOperations } from "./useOperations";

interface Options {
  connections: MongoConnection[];
  /** Lends connection `id`: its session when it's open, otherwise one opened apart. */
  borrowSession: (id: string) => Promise<BorrowedSession>;
  data: ReturnType<typeof useDataOperations>;
}

/**
 * Lets the operations panel retry an operation (R101–R103): its connections are connected again when
 * closed, and it isn't launched when its destination can't be written to now (another operation writes
 * there, it became protected or production, or safe mode is on). What it borrowed is given back at the end.
 */
export function useRelaunch({ connections, borrowSession, data }: Options) {
  const { setRelaunch } = useOperations();

  // Registered again on every render: the relaunch always sees the connections as they are now.
  useEffect(() => {
    const relaunch: Relaunch = async (request) => {
      if (!isDataRequest(request)) throw RETRY_UNAVAILABLE;
      const target = writtenConnection(request);
      const busy = target ? data.busyReason(target) : data.busyElsewhere();
      if (busy) throw busy;
      const opened = connectOnRequest([], borrowSession);
      let started: StartedOperation | null = null;
      try {
        for (const id of usedConnections(request)) await opened.connect(id);
        const blocked = retryBlockReason(request, connections, opened.sessions().find((s) => s.conn.id === target));
        if (blocked) throw blocked;
        started = data.relaunch(request);
      } finally {
        void Promise.resolve(started?.settled).finally(opened.release);
      }
      return started;
    };
    return setRelaunch(relaunch);
  });
}
