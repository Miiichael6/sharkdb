import { progressPercent, type CopyProgress } from "../domain/copySpec";

interface Props {
  /** Last progress reported; null until the first one arrives. */
  progress: CopyProgress | null;
  /** Same-server copies run as one server-side step and report no progress. */
  sameServer: boolean;
}

/** Status line of a running copy: a progress bar with the document count, when there is one. */
export function CopyStatus({ progress, sameServer }: Props) {
  if (sameServer) return <p className="muted small">Copiando en el servidor…</p>;
  if (!progress) return <p className="muted small">Preparando la copia…</p>;
  const percent = progressPercent(progress);
  return (
    <div className="copy-progress">
      <progress max={100} value={percent} aria-label="Progreso de la copia" />
      <span className="muted small">
        {progress.copied.toLocaleString()} / {progress.total.toLocaleString()} documentos ({percent} %)
      </span>
    </div>
  );
}
