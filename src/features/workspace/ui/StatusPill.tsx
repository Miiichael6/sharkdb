import { SAFE_MODE_LABEL, statusLabel, statusLocation, tagLabel, type StatusContext } from "../domain/statusLabel";

/** Where the active tab points, in the colour of the connection's tag (LOCAL, PRODUCTION...). */
export function StatusPill({ status }: { status: StatusContext | null }) {
  if (!status) return <div className="status-pill empty">Sin conexión</div>;
  return (
    <div className={`status-pill tag-${status.tag}`} title={statusLabel(status)} role="status">
      <strong>{tagLabel(status.tag)}</strong>
      {status.safeMode && <span className="status-safe">{SAFE_MODE_LABEL}</span>}
      <span className="status-sep" aria-hidden>
        |
      </span>
      <span className="status-location">{statusLocation(status)}</span>
    </div>
  );
}
