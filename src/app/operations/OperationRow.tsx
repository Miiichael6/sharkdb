import { TAGS } from "../../features/connections/domain/connection";
import { TagBadge } from "../../features/connections/ui/TagBadge";
import {
  durationLabel,
  isRunning,
  operationOutcome,
  STATUS_LABELS,
  type Operation,
  type OperationEndpoint,
} from "../../shared/domain/operations";
import { JobProgressBar } from "../../shared/ui/JobProgressBar";

interface Props {
  operation: Operation;
  onCancel: (op: Operation) => void;
}

function Endpoint({ endpoint }: { endpoint: OperationEndpoint }) {
  const tag = TAGS.find((t) => t === endpoint.tag);
  return (
    <span className="ops-endpoint">
      {tag && <TagBadge tag={tag} />}
      <span className="ellipsis" title={endpoint.name}>
        {endpoint.name}
      </span>
    </span>
  );
}

/** One operation of the panel: its route, its progress while it runs and its outcome once it ends. */
export function OperationRow({ operation: op, onCancel }: Props) {
  return (
    <li className={`ops-row ${op.status}`}>
      <div className="ops-row-head">
        <b className="ellipsis">{op.title}</b>
        <span className="muted small">{STATUS_LABELS[op.status]}</span>
      </div>
      <div className="ops-route">
        <Endpoint endpoint={op.source} />
        <span aria-hidden>→</span>
        <Endpoint endpoint={op.target} />
      </div>
      {isRunning(op) ? (
        <div className="ops-running">
          <JobProgressBar progress={op.progress} />
          <button type="button" className="small" onClick={() => onCancel(op)}>
            Cancelar
          </button>
        </div>
      ) : (
        <p className="ops-outcome small">
          {operationOutcome(op)}
          <span className="muted"> · {durationLabel((op.endedAt ?? op.startedAt) - op.startedAt)}</span>
        </p>
      )}
    </li>
  );
}
