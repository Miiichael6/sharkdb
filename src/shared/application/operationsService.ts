// Runs background operations for the whole app: one list of them, their progress and their cancellation.
import type { CollectionResult } from "../domain/jobs";
import {
  busyTargetMessage,
  canRetry,
  operationsReducer,
  runningOn,
  type Operation,
  type OperationEvent,
  type OperationSpec,
} from "../domain/operations";
import { errorMessage } from "../errors";
import type { JobListener, RunningJob } from "./jobRunner";

/** Starts the job behind an operation (a feature service's `sync`, `backup`, `restore`). */
export type LaunchJob = (listener: JobListener) => RunningJob;

export interface StartedOperation {
  id: string;
  /** The operation once it ended, whatever the way. */
  settled: Promise<Operation>;
}

/**
 * Launches again what an operation launched (its `request`), checking first that it still can be
 * written where it goes (R103); null when it didn't start. Throws the reason it can't.
 */
export type Relaunch = (request: unknown) => Promise<StartedOperation | null>;

export const RETRY_UNAVAILABLE = "Esta operación ya no se puede reintentar";

/** The other SharkDB windows: each one is a process of its own, with operations this one doesn't see (error 60). */
export interface OtherWindows {
  /** Why nothing can start here now: what another window has running; null when nothing. */
  busy(): Promise<string | null>;
}

const NO_OTHER_WINDOWS: OtherWindows = { busy: async () => null };

export type OperationsService = ReturnType<typeof createOperationsService>;

export function createOperationsService(
  clock: () => number = Date.now,
  newId: () => string = () => crypto.randomUUID(),
  otherWindows: OtherWindows = NO_OTHER_WINDOWS,
) {
  let operations: Operation[] = [];
  // What another window had running when last asked: the backend refuses to start anything meanwhile.
  let elsewhere: string | undefined;
  const listeners = new Set<() => void>();
  const jobs = new Map<string, RunningJob>();
  const cancelRequested = new Set<string>();
  // Retries still checking their destination: a second click doesn't launch it twice.
  const retrying = new Set<string>();

  const dispatch = (event: OperationEvent) => {
    operations = operationsReducer(operations, event);
    listeners.forEach((listener) => listener());
  };
  const find = (id: string) => operations.find((op) => op.id === id)!;

  async function follow(id: string, job: RunningJob, summarize: (results: CollectionResult[]) => string) {
    try {
      const results = await job.result;
      dispatch({ type: "finished", id, results, summary: summarize(results), at: clock() });
    } catch (e) {
      if (cancelRequested.has(id)) dispatch({ type: "cancelled", id, at: clock() });
      else dispatch({ type: "failed", id, error: errorMessage(e), at: clock() });
    } finally {
      jobs.delete(id);
      cancelRequested.delete(id);
    }
    return find(id);
  }

  return {
    /** Every operation of the session, oldest first; a new array after each change. */
    list: () => operations,
    /** Why nothing can start now because of another window, as last checked (`checkElsewhere`). */
    busyElsewhere: () => elsewhere,
    /** Asks the other windows again what they have running; it's polled while the app is open. */
    async checkElsewhere() {
      elsewhere = (await otherWindows.busy().catch(() => null)) ?? undefined;
    },
    /** Calls `listener` after every change; returns the function that stops it. */
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    /**
     * Starts `spec` with `launch`. Throws `OPERATION_BUSY_TARGET` when another running operation
     * already writes to the same connection; operations that only read (backups) never collide.
     */
    start(spec: OperationSpec, launch: LaunchJob, summarize: (results: CollectionResult[]) => string): StartedOperation {
      if (spec.writesTo && runningOn(operations, spec.writesTo)) throw busyTargetMessage(spec.target.name);
      const id = newId();
      dispatch({ type: "started", id, spec, at: clock() });
      const job = launch({
        progress: (progress) => dispatch({ type: "progress", id, progress }),
        collection: (update) => dispatch({ type: "collection", id, update }),
      });
      jobs.set(id, job);
      return { id, settled: follow(id, job, summarize) };
    },
    /** Asks a running operation to stop; it ends as cancelled once the backend stops it. */
    cancel(id: string) {
      const job = jobs.get(id);
      if (!job) return;
      cancelRequested.add(id);
      job.cancel();
    },
    /**
     * Launches ended operation `id` again with its same request (R102): a new operation, while `id`
     * stays in the history marked as retried. Throws `RETRY_UNAVAILABLE` when it can't be retried.
     */
    async retry(id: string, relaunch: Relaunch): Promise<StartedOperation | null> {
      const op = operations.find((candidate) => candidate.id === id);
      if (!op || !canRetry(op) || retrying.has(id)) throw RETRY_UNAVAILABLE;
      retrying.add(id);
      try {
        const started = await relaunch(op.request);
        if (started) dispatch({ type: "retried", id, by: started.id });
        return started;
      } finally {
        retrying.delete(id);
      }
    },
    /** Removes the ended operations from the list. */
    clearFinished: () => dispatch({ type: "cleared" }),
    /** Removes one ended operation from the list; a running one stays. */
    dismiss: (id: string) => dispatch({ type: "dismissed", id }),
  };
}
