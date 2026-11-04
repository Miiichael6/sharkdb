import { TAGS } from "../../features/connections/domain/connection";
import { TagBadge } from "../../features/connections/ui/TagBadge";
import { NodeIcon } from "../../features/explorer/ui/NodeIcon";
import type { OperationEndpoint } from "../../shared/domain/operations";

interface Props {
  endpoint: OperationEndpoint;
  /** Opens a backup folder; the end of a folder shows its icon as the button. */
  onOpenFolder: (path: string) => void;
}

/**
 * One end of an operation: a connection (server icon, environment, name and address) or a backup
 * folder (folder icon, opened with a click, and its full path) (R90).
 */
export function EndpointLabel({ endpoint, onOpenFolder }: Props) {
  const tag = TAGS.find((t) => t === endpoint.tag);
  const { path } = endpoint;
  const where = path ?? endpoint.address;
  return (
    <span className="ops-endpoint">
      {path ? (
        <button
          type="button"
          className="ghost ops-folder"
          onClick={() => onOpenFolder(path)}
          aria-label={`Abrir la carpeta ${endpoint.name}`}
          title={`Abrir ${path}`}
        >
          <NodeIcon kind="collections" />
        </button>
      ) : (
        <NodeIcon kind="server" />
      )}
      {tag && <TagBadge tag={tag} />}
      <span className="ops-endpoint-text">
        <span className="ellipsis" title={endpoint.name}>
          {endpoint.name}
        </span>
        {where && (
          <span className="ops-address ellipsis muted small" title={where}>
            {where}
          </span>
        )}
      </span>
    </span>
  );
}
