import { TAGS } from "../../features/connections/domain/connection";
import { TagBadge } from "../../features/connections/ui/TagBadge";
import { NodeIcon } from "../../features/explorer/ui/NodeIcon";
import { progressCount } from "../../shared/domain/jobs";
import {
  durationLabel,
  isRunning,
  operationDetail,
  STATUS_LABELS,
  type Operation,
  type OperationEndpoint,
} from "../../shared/domain/operations";
import { JobProgressBar } from "../../shared/ui/JobProgressBar";
import { useNotify } from "../../shared/ui/useNotifications";
import { useServices } from "../services";
import { useElapsed } from "./useElapsed";

interface Props {
  operation: Operation;
  onCancel: (op: Operation) => void;
  /** Removes the row once the operation ended. */
  onDismiss: (op: Operation) => void;
}

/** A connection (server icon and environment) or a backup folder (folder icon, opened with a click). */
function Endpoint({ endpoint }: { endpoint: OperationEndpoint }) {
  const { backup } = useServices();
  const notify = useNotify();
  const tag = TAGS.find((t) => t === endpoint.tag);
  const { path } = endpoint;
  return (
    <span className="ops-endpoint">
      {path ? (
        <button
          type="button"
          className="ghost ops-folder"
          onClick={() => backup.openFolder(path).catch(notify.fail)}
          aria-label={`Abrir la carpeta ${endpoint.name}`}
          title={`Abrir ${path}`}
        >
          <NodeIcon kind="collections" />
        </button>
      ) : (
        <NodeIcon kind="server" />
      )}
      {tag && <TagBadge tag={tag} />}
      <span className="ellipsis" title={path ?? endpoint.name}>
        {endpoint.name}
      </span>
    </span>
  );
}

/** One operation of the panel: its route, its progress while it runs and its outcome once it ends. */
export function OperationRow({ operation: op, onCancel, onDismiss }: Props) {
  const detail = operationDetail(op);
  const running = isRunning(op);
  const elapsed = useElapsed(op.startedAt, op.endedAt);
  return (
    <li className={`ops-row ${op.status}`}>
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
        <Endpoint endpoint={op.source} />
        <span className="ops-arrow" aria-hidden>
          →
        </span>
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
        detail && <p className="ops-outcome small">{detail}</p>
      )}
    </li>
  );
}
