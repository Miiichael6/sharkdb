import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { LaunchJob, StartedOperation } from "../../shared/application/operationsService";
import type { CollectionResult } from "../../shared/domain/jobs";
import { cancelConfirmation, operationOutcome, type Operation, type OperationSpec } from "../../shared/domain/operations";
import { confirmInWindow } from "../../shared/ui/confirmInWindow";
import { useNotify } from "../../shared/ui/useNotifications";
import { useServices } from "../services";
import { useCancelOnClose } from "./useCancelOnClose";

interface OperationsContextValue {
  /** Every operation of the session, oldest first. */
  operations: Operation[];
  panelOpen: boolean;
  togglePanel: () => void;
  closePanel: () => void;
  /** Starts an operation and opens the panel; null when it can't start (the reason is notified). */
  start: (spec: OperationSpec, launch: LaunchJob, summarize: (results: CollectionResult[]) => string) => StartedOperation | null;
  /** Cancels `op` once confirmed in its own window. */
  cancel: (op: Operation) => Promise<void>;
  clearFinished: () => void;
}

const OperationsContext = createContext<OperationsContextValue | null>(null);

/**
 * The background operations of the main window: they keep running while the app is used, report
 * their end in the notification center and are cancelled (once confirmed) when the app closes.
 */
export function OperationsProvider({ children }: { children: ReactNode }) {
  const { operations: service } = useServices();
  const operations = useSyncExternalStore(service.subscribe, service.list);
  const [panelOpen, setPanelOpen] = useState(false);
  const notify = useNotify();
  useCancelOnClose(service);

  const start = useCallback<OperationsContextValue["start"]>(
    (spec, launch, summarize) => {
      let started: StartedOperation;
      try {
        started = service.start(spec, launch, summarize);
      } catch (e) {
        notify.fail(e);
        return null;
      }
      setPanelOpen(true);
      void started.settled.then((op) => {
        const text = operationOutcome(op);
        if (op.status === "done") notify.ok(text);
        else if (op.status === "failed") notify.fail(text);
        else notify.info(text);
      });
      return started;
    },
    [service, notify],
  );

  const cancel = useCallback(
    async (op: Operation) => {
      const confirmed = await confirmInWindow(cancelConfirmation(op));
      if (confirmed) service.cancel(op.id);
    },
    [service],
  );

  const value = useMemo<OperationsContextValue>(
    () => ({
      operations,
      panelOpen,
      togglePanel: () => setPanelOpen((open) => !open),
      closePanel: () => setPanelOpen(false),
      start,
      cancel,
      clearFinished: service.clearFinished,
    }),
    [operations, panelOpen, start, cancel, service],
  );
  return <OperationsContext.Provider value={value}>{children}</OperationsContext.Provider>;
}

export function useOperations(): OperationsContextValue {
  const value = useContext(OperationsContext);
  if (!value) throw new Error("useOperations must be used inside <OperationsProvider>");
  return value;
}
