import { useCallback } from "react";
import type { Operation } from "../../shared/domain/operations";
import { useNotify } from "../../shared/ui/useNotifications";
import { useServices } from "../services";
import { openOperationDetail, type OperationDetailRequest } from "./operationDetailWindow";

/** Opens the detail sub-window of an operation, answering what it asks from the main window. */
export function useOperationDetail() {
  const { operations, backup } = useServices();
  const notify = useNotify();

  return useCallback(
    (op: Operation) => {
      const handle = async (id: string, request: OperationDetailRequest) => {
        // The detail already confirmed the cancellation in its own window.
        if (request.kind === "cancel") operations.cancel(id);
        else await backup.openFolder(request.path).catch(notify.fail);
      };
      const find = (id: string) => operations.list().find((candidate) => candidate.id === id);
      void openOperationDetail(op, { find, subscribe: operations.subscribe, handle });
    },
    [operations, backup, notify],
  );
}
