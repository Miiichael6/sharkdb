import { useState } from "react";
import type { RunningJob } from "../application/jobRunner";
import type { CollectionResult, JobProgress } from "../domain/jobs";
import { errorMessage } from "../errors";

/** Runs one job (backup, restore, sync) at a time, keeping its progress and error for the dialog. */
export function useJob() {
  const [running, setRunning] = useState<RunningJob | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [error, setError] = useState("");

  /** Resolves to the results, or null when the job failed or was cancelled (the error is kept). */
  const run = async (start: (onProgress: (p: JobProgress) => void) => RunningJob): Promise<CollectionResult[] | null> => {
    setError("");
    setProgress(null);
    const job = start(setProgress);
    setRunning(job);
    try {
      return await job.result;
    } catch (e) {
      setError(errorMessage(e));
      return null;
    } finally {
      setRunning(null);
    }
  };

  return { busy: !!running, progress, error, setError, run, cancel: () => running?.cancel() };
}
