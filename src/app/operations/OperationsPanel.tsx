import { isRunning, OPERATION_KINDS, operationsOfKind } from "../../shared/domain/operations";
import { OperationsSection } from "./OperationsSection";
import { useOperations } from "./useOperations";

/** Right-hand panel of the main window with the background operations; closing it stops nothing. */
export function OperationsPanel({ width }: { width: number }) {
  const { operations, closePanel, cancel, clearFinished, dismiss } = useOperations();
  const anyEnded = operations.some((op) => !isRunning(op));

  return (
    <aside className="ops-panel" aria-label="Operaciones" style={{ width }}>
      <header>
        <strong>Operaciones</strong>
        <button type="button" className="ghost small" onClick={clearFinished} disabled={!anyEnded}>
          Limpiar terminadas
        </button>
        <button type="button" className="ghost small" onClick={closePanel} aria-label="Cerrar el panel de operaciones" title="Cerrar">
          ×
        </button>
      </header>
      <div className="ops-sections">
        {OPERATION_KINDS.map((kind) => (
          <OperationsSection
            key={kind}
            kind={kind}
            operations={operationsOfKind(operations, kind)}
            onCancel={(op) => void cancel(op)}
            onDismiss={(op) => dismiss(op.id)}
          />
        ))}
      </div>
    </aside>
  );
}
