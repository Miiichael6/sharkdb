import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import type { LaunchJob, Relaunch, StartedOperation } from "../../shared/application/operationsService";
import type { CollectionResult } from "../../shared/domain/jobs";
import { cancelConfirmation, operationOutcome, retryConfirmation, type Operation, type OperationSpec } from "../../shared/domain/operations";
import { confirmInWindow } from "../../shared/ui/confirmInWindow";
import { useNotify } from "../../shared/ui/useNotifications";
import { useRightSidebar } from "../rightSidebar/useRightSidebar";
import { useServices } from "../services";
import { useCancelOnClose } from "./useCancelOnClose";

interface OperationsContextValue {
  /** Every operation of the session, oldest first. */
  operations: Operation[];
  /** Starts an operation and shows the Operaciones tab; null when it can't start (the reason is notified). */
  start: (spec: OperationSpec, launch: LaunchJob, summarize: (results: CollectionResult[]) => string) => StartedOperation | null;
  /** Cancels `op` once confirmed in its own window. */
  cancel: (op: Operation) => Promise<void>;
  /** Launches ended `op` again once confirmed in a short window, without the confirmation word (D27). */
  retry: (op: Operation) => Promise<void>;
  /** Launches ended operation `id` again, already confirmed (the detail asks in its own window). */
  retryNow: (id: string) => Promise<void>;
  /**
   * Sets what launches an operation's request again (the workspace, which knows the connections);
   * returns what removes it.
   */
  setRelaunch: (relaunch: Relaunch) => () => void;
  clearFinished: () => void;
  /** Removes one ended operation from the panel. */
  dismiss: (id: string) => void;
}

const OperationsContext = createContext<OperationsContextValue | null>(null);

/** Shown when retrying with no workspace to check the connections: it never happens from the panel. */
const NO_RELAUNCH: Relaunch = () => Promise.reject("Abre una conexión para reintentar la operación");

/** How often the other windows are asked what they have running (error 60). */
const ELSEWHERE_POLL_MS = 3000;

/**
 * The background operations of the main window: they keep running while the app is used, report
 * their end in the notification center and are cancelled (once confirmed) when the app closes.
 */
export function OperationsProvider({ children }: { children: ReactNode }) {
  const { operations: service } = useServices();
  const operations = useSyncExternalStore(service.subscribe, service.list);
  const { show } = useRightSidebar();
  const notify = useNotify();
  useCancelOnClose(service);
  const relaunch = useRef<Relaunch>(NO_RELAUNCH);

  useEffect(() => {
    void service.checkElsewhere();
    const timer = setInterval(() => void service.checkElsewhere(), ELSEWHERE_POLL_MS);
    return () => clearInterval(timer);
  }, [service]);

  const start = useCallback<OperationsContextValue["start"]>(
    (spec, launch, summarize) => {
      let started: StartedOperation;
      try {
        started = service.start(spec, launch, summarize);
      } catch (e) {
        notify.fail(e);
        return null;
      }
      show("operations");
      void started.settled.then((op) => {
        const text = operationOutcome(op);
        if (op.status === "done") notify.ok(text);
        else if (op.status === "failed") notify.fail(text);
        else notify.info(text);
      });
      return started;
    },
    [service, notify, show],
  );

  const cancel = useCallback(
    async (op: Operation) => {
      const confirmed = await confirmInWindow(cancelConfirmation(op));
      if (confirmed) service.cancel(op.id);
    },
    [service],
  );

  const retryNow = useCallback(
    async (id: string) => {
      // Whether it started or why not was already notified by `start`; what's left is why it couldn't.
      await service.retry(id, (request) => relaunch.current(request)).catch(notify.fail);
    },
    [service, notify],
  );

  const retry = useCallback(
    async (op: Operation) => {
      if (await confirmInWindow(retryConfirmation(op))) await retryNow(op.id);
    },
    [retryNow],
  );

  const setRelaunch = useCallback((next: Relaunch) => {
    relaunch.current = next;
    return () => {
      if (relaunch.current === next) relaunch.current = NO_RELAUNCH;
    };
  }, []);

  const value = useMemo<OperationsContextValue>(
    () => ({
      operations,
      start,
      cancel,
      retry,
      retryNow,
      setRelaunch,
      clearFinished: service.clearFinished,
      dismiss: service.dismiss,
    }),
    [operations, start, cancel, retry, retryNow, setRelaunch, service],
  );
  return <OperationsContext.Provider value={value}>{children}</OperationsContext.Provider>;
}

export function useOperations(): OperationsContextValue {
  const value = useContext(OperationsContext);
  if (!value) throw new Error("useOperations must be used inside <OperationsProvider>");
  return value;
}
