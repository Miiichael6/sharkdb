import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  BACK_LABEL,
  DISMISS_LABEL,
  MODIFY_HEADING,
  confirmationMatches,
  dangerExpanded,
  totalCollections,
  type DangerAnswer,
  type DangerConfirmRequest,
  type DangerItem,
} from "../domain/confirmation";
import { databasesLabel } from "../domain/databasePlan";
import { collectionsLabel } from "../domain/jobs";
import { ConfirmWordField } from "./ConfirmWordField";

/** "2 bases de datos · 35 colecciones": the size of the whole operation at a glance. */
const dangerTotals = (items: DangerItem[]) => `${databasesLabel(items.length)} · ${collectionsLabel(totalCollections(items))}`;

interface Props {
  request: DangerConfirmRequest;
  /** The destination's environment pill (the opener knows how to draw it). */
  targetBadge?: ReactNode;
  /** "confirm", "back", or null to cancel. */
  onDone: (answer: DangerAnswer | null) => void;
}

/**
 * Second window of an operation that writes (D9): "Se va a MODIFICAR" (or "GUARDAR") with what changes, and the
 * red button only enabled once `CONFIRM_WORD` is typed. Escape cancels.
 */
export function DangerConfirmWindow({ request, targetBadge, onDone }: Props) {
  const [typed, setTyped] = useState("");
  const canConfirm = confirmationMatches(typed) && !request.blocked;
  const expanded = dangerExpanded(request.items);

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
            <span>{request.heading ?? MODIFY_HEADING}</span>
            {targetBadge}
            <b>{request.target.name}</b>
          </div>
          <p className="muted small">{request.intro}</p>
          <div className="danger-totals">{dangerTotals(request.items)}</div>
          <ul className="danger-dbs">
            {request.items.map((item) => (
              <li key={item.name} className="danger-db">
                <details open={expanded}>
                  <summary className="danger-db-head">
                    <span className={`plan-action ${item.kind}`}>{item.badge}</span>
                    <b className="ellipsis" title={item.name}>
                      {item.name}
                    </b>
                    <span className="muted small">{item.detail}</span>
                  </summary>
                  <ul className="danger-collections">
                    {item.collections.map((c) => (
                      <li key={c} className="ellipsis" title={c}>
                        {c}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
          {request.note && <p className="muted small">{request.note}</p>}
        </div>

        {request.blocked && <div className="restore-banner blocked">{request.blocked}</div>}

        <ConfirmWordField typed={typed} onChange={setTyped} disabled={!!request.blocked} />
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
