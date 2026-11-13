import { useState, type KeyboardEvent } from "react";
import { byDatabase, usesStaging, type CollectionPhase } from "../../shared/domain/collectionProgress";
import {
  canRetry,
  cancelConfirmation,
  durationLabel,
  isRunning,
  KIND_LABELS,
  operationDetail,
  RETRIED_LABEL,
  retryConfirmation,
  STATUS_LABELS,
  type Operation,
} from "../../shared/domain/operations";
import { confirmInWindow } from "../../shared/ui/confirmInWindow";
import { JobProgressBar } from "../../shared/ui/JobProgressBar";
import { askOpener } from "../../shared/ui/modalWindow";
import { useEscapeDiscard } from "../../shared/ui/useEscapeDiscard";
import { DatabaseList } from "./DatabaseList";
import { EndpointLabel } from "./EndpointLabel";
import { OPERATION_DETAIL_VIEW, type OperationDetailRequest } from "./operationDetailWindow";
import { PhaseSection } from "./PhaseSection";
import { useElapsed } from "./useElapsed";

const NO_COLLECTIONS = "Sin colecciones";
const NO_MATCHES = "Ninguna colección coincide";
const PHASES: CollectionPhase[] = ["copy", "replace"];

const ask = (request: OperationDetailRequest) => askOpener<void>(OPERATION_DETAIL_VIEW, request);

/** One end of the route with its role over it: where it reads from, where it writes to. */
function RouteEnd({ role, operation, end }: { role: string; operation: Operation; end: "source" | "target" }) {
  return (
    <div className="ops-detail-end">
      <span className="ops-detail-role muted small">{role}</span>
      <EndpointLabel endpoint={operation[end]} onOpenFolder={(path) => void ask({ kind: "open-folder", path })} />
    </div>
  );
}

/**
 * The detail sub-window of an operation (R89): its state and duration, where it goes from and to,
 * and each of its collections by database. The main window keeps `operation` up to date.
 */
export function OperationDetail({ operation: op, onClose }: { operation: Operation; onClose: () => void }) {
  useEscapeDiscard(false, "El detalle", onClose);
  const elapsed = useElapsed(op.startedAt, op.endedAt);
  const running = isRunning(op);
  const [query, setQuery] = useState("");
  const groups = byDatabase(op.collections);
  // Escape empties the filter first; only an empty one lets it close the window.
  const onFilterKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || !query) return;
    e.stopPropagation();
    setQuery("");
  };
  const outcome = operationDetail(op);
  const cancel = async () => {
    if (await confirmInWindow(cancelConfirmation(op))) await ask({ kind: "cancel" });
  };
  const retry = async () => {
    if (await confirmInWindow(retryConfirmation(op))) await ask({ kind: "retry" });
  };

  return (
    <div className="ops-detail">
      <header className="ops-detail-head">
        <strong>{KIND_LABELS[op.kind]}</strong>
        <span className={`ops-status ${op.status}`}>{STATUS_LABELS[op.status]}</span>
        {op.retriedBy && <span className="ops-retried muted small">{RETRIED_LABEL}</span>}
        <span className="ops-elapsed muted small" title={running ? "Tiempo transcurrido" : "Duración"}>
          {durationLabel(elapsed)}
        </span>
        <span className="spacer" />
        {running && (
          <button type="button" className="small" onClick={() => void cancel()}>
            Cancelar
          </button>
        )}
        {canRetry(op) && (
          <button type="button" className="small" onClick={() => void retry()} aria-label="Reintentar">
            ⟳ Reintentar
          </button>
        )}
      </header>
      <div className="ops-detail-route">
        <RouteEnd role="Origen" operation={op} end="source" />
        <span className="ops-arrow" aria-hidden>
          →
        </span>
        <RouteEnd role="Destino" operation={op} end="target" />
      </div>
      {running ? <JobProgressBar progress={op.progress} /> : outcome && <p className={`ops-outcome small ${op.status}`}>{outcome}</p>}
      {groups.length > 0 && (
        <input
          className="search ops-detail-filter"
          type="search"
          placeholder="Filtrar colecciones o bases…"
          aria-label="Filtrar colecciones o bases"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onFilterKey}
        />
      )}
      {groups.length > 0 && usesStaging(op.kind) ? (
        <div className="ops-detail-phases">
          {PHASES.map((phase) => (
            <PhaseSection
              key={phase}
              phase={phase}
              collections={op.collections}
              query={query}
              kind={op.kind}
              results={op.results}
              noMatches={NO_MATCHES}
              databaseCount={groups.length}
            />
          ))}
        </div>
      ) : (
        <div className="ops-detail-dbs">
          <DatabaseList
            groups={groups}
            query={query}
            kind={op.kind}
            results={op.results}
            empty={groups.length ? NO_MATCHES : NO_COLLECTIONS}
            databaseCount={groups.length}
          />
        </div>
      )}
      <div className="modal-footer">
        <span className="spacer" />
        <button type="button" className="primary" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
