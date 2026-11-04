// Starts a backend job identified by an id, follows its progress and lets it be cancelled.
import type { CollectionUpdate } from "../domain/collectionProgress";
import type { CollectionResult, JobProgress } from "../domain/jobs";

type Unlisten = () => void;

/** The backend side every job shares: progress events and cancellation. */
export interface JobEvents {
  /** Overall progress of every job; resolves to the function that stops listening. */
  onProgress(listener: (progress: JobProgress) => void): Promise<Unlisten>;
  /** State and progress of each collection of every job. */
  onCollection(listener: (update: CollectionUpdate) => void): Promise<Unlisten>;
  cancel(job: string): Promise<void>;
}

/** A started job: its outcome and how to stop it. */
export interface RunningJob {
  result: Promise<CollectionResult[]>;
  cancel: () => void;
}

/** Who hears how one job goes: its overall progress and each of its collections. */
export interface JobListener {
  progress(progress: JobProgress): void;
  collection(update: CollectionUpdate): void;
}

/**
 * How long the job keeps listening once its command returned: Tauri doesn't promise that events
 * emitted before the return arrive before it, and the last ones (applied, failed) matter.
 */
const LATE_EVENTS_MS = 100;
const waitForLateEvents = () => new Promise<void>((resolve) => setTimeout(resolve, LATE_EVENTS_MS));

export type StartJob = (run: (job: string) => Promise<CollectionResult[]>, listener: JobListener) => RunningJob;

export function createJobRunner(
  events: JobEvents,
  newJobId: () => string = () => crypto.randomUUID(),
  lateEvents: () => Promise<void> = waitForLateEvents,
): StartJob {
  return (run, listener) => {
    const job = newJobId();
    const result = (async () => {
      // Listening first, so the first events aren't missed.
      const stops = await Promise.all([
        events.onProgress((p) => p.job === job && listener.progress(p)),
        events.onCollection((u) => u.job === job && listener.collection(u)),
      ]);
      try {
        return await run(job);
      } finally {
        // Before the outcome is known: the operation ends after its last collections did.
        await lateEvents();
        stops.forEach((stop) => stop());
      }
    })();
    return { result, cancel: () => void events.cancel(job) };
  };
}
