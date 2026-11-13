import { HostIcon } from "../../connections/ui/HostIcon";
import { NodeIcon } from "../../explorer/ui/NodeIcon";

interface Props {
  /** The connection; left out where a field chooses it (the destination of the first window). */
  name?: string;
  /** Host and port (and the SSH tunnel, if any); left out while no connection is chosen. */
  address?: string;
  db: string;
  collection: string;
}

/** Where the documents come from or go: connection, database and collection, each with the explorer's icon. */
export function DocumentSyncPlace({ name, address, db, collection }: Props) {
  return (
    <div className="doc-sync-place">
      {name && (
        <span className="where-part" title="Conexión">
          <NodeIcon kind="server" size={14} />
          <b className="ellipsis">{name}</b>
        </span>
      )}
      {address && (
        <span className="where-part doc-sync-host" title={`Host y puerto: ${address}`}>
          <HostIcon />
          <span className="mono small ellipsis">{address}</span>
        </span>
      )}
      <span className="doc-sync-namespace">
        <span className="where-part" title="Base de datos">
          <NodeIcon kind="database" size={14} />
          <span className="mono small ellipsis">{db}</span>
        </span>
        <span className="where-part" title="Colección">
          <NodeIcon kind="collection" size={14} />
          <span className="mono small ellipsis">{collection}</span>
        </span>
      </span>
    </div>
  );
}
