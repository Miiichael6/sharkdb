// Runs background operations for the whole app: one list of them, their progress and their cancellation.
import type { CollectionResult, JobProgress } from "../domain/jobs";
import {
  busyTargetMessage,
  operationsReducer,
  runningOn,
  type Operation,
  type OperationEvent,
  type OperationSpec,
} from "../domain/operations";
import { errorMessage } from "../errors";
import type { RunningJob } from "./jobRunner";

/** Starts the job behind an operation (a feature service's `sync`, `backup`, `restore`). */
export type LaunchJob = (onProgress: (progress: JobProgress) => void) => RunningJob;

export interface StartedOperation {
  id: string;
  /** The operation once it ended, whatever the way. */
  settled: Promise<Operation>;
}

export type OperationsService = ReturnType<typeof createOperationsService>;

export function createOperationsService(clock: () => number = Date.now, newId: () => string = () => crypto.randomUUID()) {
  let operations: Operation[] = [];
  const listeners = new Set<() => void>();
  const jobs = new Map<string, RunningJob>();
  const cancelRequested = new Set<string>();

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
      const job = launch((progress) => dispatch({ type: "progress", id, progress }));
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
    /** Removes the ended operations from the list. */
    clearFinished: () => dispatch({ type: "cleared" }),
    /** Removes one ended operation from the list; a running one stays. */
    dismiss: (id: string) => dispatch({ type: "dismissed", id }),
  };
}
