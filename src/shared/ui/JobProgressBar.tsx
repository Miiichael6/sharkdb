import { progressPercent, type JobProgress } from "../domain/jobs";

/** Overall progress of a running job (backup, restore, sync), with the collection in course; its count is shown apart. */
export function JobProgressBar({ progress }: { progress: JobProgress | null }) {
  const percent = progress ? progressPercent(progress) : 0;
  return (
    <div className="job-progress">
      <div className="job-progress-label muted small">
        <span className="ellipsis" title={progress?.collection}>
          {progress ? progress.collection : "Preparando…"}
        </span>
        <span>{percent}%</span>
      </div>
      <div className="job-progress-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="job-progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
