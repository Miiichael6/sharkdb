import { useState } from "react";
import { KIND_LABELS, NO_OPERATIONS, runningOperations, type Operation, type OperationKind } from "../../shared/domain/operations";
import { OperationRow } from "./OperationRow";

interface Props {
  kind: OperationKind;
  operations: Operation[];
  onCancel: (op: Operation) => void;
  onRetry: (op: Operation) => void;
  onDismiss: (op: Operation) => void;
  onOpen: (op: Operation) => void;
}

/** A foldable section of the panel (Sync, Backup or Restore), newest operation first. */
export function OperationsSection({ kind, operations, onCancel, onRetry, onDismiss, onOpen }: Props) {
  const [open, setOpen] = useState(true);
  const running = runningOperations(operations).length;
  const listId = `ops-section-${kind}`;

  return (
    <section className="ops-section">
      <button type="button" className="ops-section-head" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(!open)}>
        <span className="ops-caret" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
        {KIND_LABELS[kind]}
        {running > 0 && <span className="ops-count">{running}</span>}
      </button>
      {open &&
        (operations.length ? (
          <ul id={listId} className="ops-list">
            {[...operations].reverse().map((op) => (
              <OperationRow key={op.id} operation={op} onCancel={onCancel} onRetry={onRetry} onDismiss={onDismiss} onOpen={onOpen} />
            ))}
          </ul>
        ) : (
          <p id={listId} className="muted small ops-empty">
            {NO_OPERATIONS}
          </p>
        ))}
    </section>
  );
}
