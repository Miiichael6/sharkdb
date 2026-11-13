import type { ReactNode } from "react";
import type { TargetWhere } from "../../../shared/domain/documentTarget";
import { NodeIcon } from "../../explorer/ui/NodeIcon";
import { TAGS } from "../domain/connection";
import { HostIcon } from "./HostIcon";
import { TagBadge } from "./TagBadge";

/**
 * Connection (name, address, environment), database and collection something acts on, so it can't be
 * mistaken for another one. `children` adds parts at the end (e.g. the shell's query time).
 */
export function WhereBar({
  where,
  className = "",
  children,
}: {
  /** Without `db` it shows only the connection (e.g. deleting a saved connection). */
  where: Omit<TargetWhere, "db"> & { db?: string };
  className?: string;
  children?: ReactNode;
}) {
  const { server, db, coll } = where;
  const tag = TAGS.find((t) => t === server.tag);
  return (
    <span className={`shell-where ${className}`}>
      <span className="where-part" title="Servidor">
        <NodeIcon kind="server" size={14} />
        <strong>{server.name}</strong>
        {tag && <TagBadge tag={tag} />}
        {server.host && (
          <span className="host-chip" title="Dirección">
            <HostIcon />
            {server.host}
          </span>
        )}
      </span>
      {db && (
        <span className="where-part" title="Base de datos">
          <NodeIcon kind="database" size={14} />
          {db}
        </span>
      )}
      {coll && (
        <span className="where-part" title="Colección">
          <NodeIcon kind="collection" size={14} />
          {coll}
        </span>
      )}
      {children}
    </span>
  );
}
