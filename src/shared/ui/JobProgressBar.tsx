import { progressPercent, type JobProgress } from "../domain/jobs";

/** Overall progress of a running job (backup, restore, sync), with the collection in course. */
export function JobProgressBar({ progress }: { progress: JobProgress | null }) {
  const percent = progress ? progressPercent(progress) : 0;
  return (
    <div className="job-progress">
      <div className="job-progress-label muted small">
        <span>{progress ? `${progress.collection} (${progress.index + 1} de ${progress.count})` : "Preparando…"}</span>
        <span>{percent}%</span>
      </div>
      <div className="job-progress-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="job-progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
