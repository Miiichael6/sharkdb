import { isRunning, OPERATION_KINDS, operationsOfKind } from "../../shared/domain/operations";
import { OperationsSection } from "./OperationsSection";
import { useOperationDetail } from "./useOperationDetail";
import { useOperations } from "./useOperations";

/** The Operaciones tab of the right sidebar: the background operations of the main window. */
export function OperationsPanel() {
  const { operations, cancel, retry, clearFinished, dismiss } = useOperations();
  const openDetail = useOperationDetail();
  const anyEnded = operations.some((op) => !isRunning(op));

  return (
    <section className="ops-panel" aria-label="Operaciones">
      <header>
        <button type="button" className="ghost small" onClick={clearFinished} disabled={!anyEnded}>
          Limpiar terminadas
        </button>
      </header>
      <div className="ops-sections">
        {OPERATION_KINDS.map((kind) => (
          <OperationsSection
            key={kind}
            kind={kind}
            operations={operationsOfKind(operations, kind)}
            onCancel={(op) => void cancel(op)}
            onRetry={(op) => void retry(op)}
            onDismiss={(op) => dismiss(op.id)}
            onOpen={openDetail}
          />
        ))}
      </div>
    </section>
  );
}
