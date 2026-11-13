import { useCallback } from "react";
import type { Operation } from "../../shared/domain/operations";
import { useNotify } from "../../shared/ui/useNotifications";
import { useServices } from "../services";
import { openOperationDetail, type OperationDetailRequest } from "./operationDetailWindow";
import { useOperations } from "./useOperations";

/** Opens the detail sub-window of an operation, answering what it asks from the main window. */
export function useOperationDetail() {
  const { operations, backup } = useServices();
  const notify = useNotify();
  const { retryNow } = useOperations();

  return useCallback(
    (op: Operation) => {
      const handle = async (id: string, request: OperationDetailRequest) => {
        // The detail already confirmed the cancellation or the retry in its own window.
        if (request.kind === "cancel") operations.cancel(id);
        else if (request.kind === "retry") await retryNow(id);
        else await backup.openFolder(request.path).catch(notify.fail);
      };
      const find = (id: string) => operations.list().find((candidate) => candidate.id === id);
      void openOperationDetail(op, { find, subscribe: operations.subscribe, handle });
    },
    [operations, backup, notify, retryNow],
  );
}
