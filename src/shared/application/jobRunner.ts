// Starts a backend job identified by an id, follows its progress and lets it be cancelled.
import type { CollectionResult, JobProgress } from "../domain/jobs";

/** The backend side every job shares: progress events and cancellation. */
export interface JobEvents {
  /** Progress of every job; resolves to the function that stops listening. */
  onProgress(listener: (progress: JobProgress) => void): Promise<() => void>;
  cancel(job: string): Promise<void>;
}

/** A started job: its outcome and how to stop it. */
export interface RunningJob {
  result: Promise<CollectionResult[]>;
  cancel: () => void;
}

export type OnProgress = (progress: JobProgress) => void;

export type StartJob = (run: (job: string) => Promise<CollectionResult[]>, onProgress: OnProgress) => RunningJob;

export function createJobRunner(events: JobEvents, newJobId: () => string = () => crypto.randomUUID()): StartJob {
  return (run, onProgress) => {
    const job = newJobId();
    const result = (async () => {
      // Listening first, so the first progress event isn't missed.
      const stop = await events.onProgress((p) => p.job === job && onProgress(p));
      try {
        return await run(job);
      } finally {
        stop();
      }
    })();
    return { result, cancel: () => void events.cancel(job) };
  };
}
