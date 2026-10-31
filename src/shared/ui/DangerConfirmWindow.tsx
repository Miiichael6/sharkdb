import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  BACK_LABEL,
  CONFIRM_WORD,
  DISMISS_LABEL,
  confirmationMatches,
  type DangerAnswer,
  type DangerConfirmRequest,
} from "../domain/confirmation";

interface Props {
  request: DangerConfirmRequest;
  /** The destination's environment pill (the opener knows how to draw it). */
  targetBadge?: ReactNode;
  /** "confirm", "back", or null to cancel. */
  onDone: (answer: DangerAnswer | null) => void;
}

/**
 * Second window of an operation that writes (D9): "Se va a MODIFICAR" with what changes, and the
 * red button only enabled once `CONFIRM_WORD` is typed. Escape cancels.
 */
export function DangerConfirmWindow({ request, targetBadge, onDone }: Props) {
  const [typed, setTyped] = useState("");
  const confirmed = confirmationMatches(typed);
  const canConfirm = confirmed && !request.blocked;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (canConfirm) onDone("confirm");
  };

  return (
    <form className="danger-window" role="alertdialog" aria-label={request.title} onSubmit={submit}>
      <div className="danger-body">
        <div className="danger-plan">
          <div className="danger-plan-title">
            <span>Se va a MODIFICAR</span>
            {targetBadge}
            <b>{request.target.name}</b>
          </div>
          <p className="muted small">{request.intro}</p>
          <ul className="plan-steps">
            {request.items.map((item) => (
              <li key={item.name}>
                <span className={`plan-action ${item.kind}`}>{item.badge}</span>
                <b>{item.name}</b>
                <span className="muted small grow ellipsis">{item.detail}</span>
              </li>
            ))}
          </ul>
          {request.note && <p className="muted small">{request.note}</p>}
        </div>

        {request.blocked && <div className="restore-banner blocked">{request.blocked}</div>}

        <label className="stack danger-confirm">
          <span className="muted">
            Escribe <code>{CONFIRM_WORD}</code> para continuar
          </span>
          <input
            className={confirmed ? "confirmed" : ""}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={!!request.blocked}
            spellCheck={false}
            autoComplete="off"
            autoFocus
          />
        </label>
      </div>

      <div className="modal-footer danger-footer">
        <button type="button" onClick={() => onDone("back")}>
          {BACK_LABEL}
        </button>
        <span className="spacer" />
        <button type="button" onClick={() => onDone(null)}>
          {DISMISS_LABEL}
        </button>
        <button type="submit" className="danger" disabled={!canConfirm}>
          {request.confirmLabel}
        </button>
      </div>
    </form>
  );
}
