import type { KeyboardEvent, MouseEvent } from "react";
import { progressCount } from "../../shared/domain/jobs";
import {
  durationLabel,
  isRunning,
  KIND_LABELS,
  operationDetail,
  operationRoute,
  STATUS_LABELS,
  type Operation,
} from "../../shared/domain/operations";
import { JobProgressBar } from "../../shared/ui/JobProgressBar";
import { useNotify } from "../../shared/ui/useNotifications";
import { useServices } from "../services";
import { EndpointLabel } from "./EndpointLabel";
import { useElapsed } from "./useElapsed";

interface Props {
  operation: Operation;
  onCancel: (op: Operation) => void;
  /** Removes the row once the operation ended. */
  onDismiss: (op: Operation) => void;
  /** Shows its detail: where it goes and how each collection goes (R89). */
  onOpen: (op: Operation) => void;
}

/** A click on the row's own buttons (Cancelar, ×, the folder) does what they say, not open the detail. */
const fromInnerButton = (e: MouseEvent | KeyboardEvent) => (e.target as HTMLElement).closest("button") !== null;

/** Dragging over the row to copy its text (an error, a path) ends in a click too: that one doesn't open. */
const selectingText = () => !(window.getSelection()?.isCollapsed ?? true);

/** The row acts as a button: Enter and Space open it. */
const OPEN_KEYS = ["Enter", " "];

/** One operation of the panel: its route, its progress while it runs and its outcome once it ends. */
export function OperationRow({ operation: op, onCancel, onDismiss, onOpen }: Props) {
  const { backup } = useServices();
  const notify = useNotify();
  const openFolder = (path: string) => void backup.openFolder(path).catch(notify.fail);
  const detail = operationDetail(op);
  const running = isRunning(op);
  const elapsed = useElapsed(op.startedAt, op.endedAt);
  const openByClick = (e: MouseEvent) => {
    if (!fromInnerButton(e) && !selectingText()) onOpen(op);
  };
  const openByKey = (e: KeyboardEvent) => {
    if (!OPEN_KEYS.includes(e.key) || fromInnerButton(e)) return;
    e.preventDefault(); // Space would scroll the panel.
    onOpen(op);
  };
  return (
    <li
      className={`ops-row ${op.status}`}
      tabIndex={0}
      aria-label={`Ver el detalle: ${KIND_LABELS[op.kind]} ${operationRoute(op)}, ${STATUS_LABELS[op.status]}`}
      title="Ver el detalle"
      onClick={openByClick}
      onKeyDown={openByKey}
    >
      <div className="ops-row-head">
        <span className={`ops-status ${op.status}`}>{STATUS_LABELS[op.status]}</span>
        <span className="ops-row-meta">
          {running && op.progress && <span className="ops-tally">{progressCount(op.progress)}</span>}
          <span className="ops-elapsed muted small" title={running ? "Tiempo transcurrido" : "Duración"}>
            {durationLabel(elapsed)}
          </span>
          {!running && (
            <button
              type="button"
              className="ghost small ops-dismiss"
              onClick={() => onDismiss(op)}
              aria-label="Quitar esta operación del panel"
              title="Quitar"
            >
              ×
            </button>
          )}
        </span>
      </div>
      <div className="ops-route">
        <EndpointLabel endpoint={op.source} onOpenFolder={openFolder} />
        <span className="ops-arrow" aria-hidden>
          ↓
        </span>
        <EndpointLabel endpoint={op.target} onOpenFolder={openFolder} />
      </div>
      {running ? (
        <div className="ops-running">
          <JobProgressBar progress={op.progress} />
          <button type="button" className="small" onClick={() => onCancel(op)}>
            Cancelar
          </button>
        </div>
      ) : (
        detail && <p className="ops-outcome small">{detail}</p>
      )}
    </li>
  );
}
