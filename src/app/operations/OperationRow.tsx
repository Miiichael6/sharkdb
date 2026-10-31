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

interface Props {
  operation: Operation;
  onCancel: (op: Operation) => void;
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
export function OperationRow({ operation: op, onCancel }: Props) {
  const detail = operationDetail(op);
  return (
    <li className={`ops-row ${op.status}`}>
      <div className="ops-row-head">
        <span className={`ops-status ${op.status}`}>{STATUS_LABELS[op.status]}</span>
        {isRunning(op)
          ? op.progress && <span className="ops-tally">{progressCount(op.progress)}</span>
          : <span className="muted small">{durationLabel((op.endedAt ?? op.startedAt) - op.startedAt)}</span>}
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
