import { SAFE_MODE_LABEL, statusLabel, statusLocation, tagLabel, type StatusContext } from "../domain/statusLabel";

/** What a toolbar button does, dropped over the pill while the button is hovered or focused. */
function PillHint({ hint }: { hint: string | null }) {
  if (!hint) return null;
  // The key replays the drop for each button. The button's own label already reaches screen readers.
  return (
    <span key={hint} className="status-hint" aria-hidden>
      {hint}
    </span>
  );
}

/** Where the active tab points, in the colour of the connection's tag (LOCAL, PRODUCTION...). */
export function StatusPill({ status, hint = null }: { status: StatusContext | null; hint?: string | null }) {
  if (!status)
    return (
      <div className="status-pill empty" data-tauri-drag-region>
        Sin conexión
        <PillHint hint={hint} />
      </div>
    );
  return (
    <div className={`status-pill tag-${status.tag}`} title={statusLabel(status)} role="status" data-tauri-drag-region>
      <strong>{tagLabel(status.tag)}</strong>
      {status.safeMode && <span className="status-safe">{SAFE_MODE_LABEL}</span>}
      <span className="status-sep" aria-hidden>
        |
      </span>
      <span className="status-location">{statusLocation(status)}</span>
      <PillHint hint={hint} />
    </div>
  );
}
