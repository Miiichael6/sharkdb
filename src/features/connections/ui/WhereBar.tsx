import type { ReactNode } from "react";
import type { TargetWhere } from "../../../shared/domain/documentTarget";
import { NodeIcon } from "../../explorer/ui/NodeIcon";
import { TAGS } from "../domain/connection";
import { TagBadge } from "./TagBadge";

function HostIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden className="icon">
      <path
        fillRule="evenodd"
        d="M2.5 2h11A1.5 1.5 0 0 1 15 3.5v7a1.5 1.5 0 0 1-1.5 1.5H9.5v1.5H11a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1h1.5V12h-4A1.5 1.5 0 0 1 1 10.5v-7A1.5 1.5 0 0 1 2.5 2Zm0 1.3a.2.2 0 0 0-.2.2v7c0 .1.1.2.2.2h11a.2.2 0 0 0 .2-.2v-7a.2.2 0 0 0-.2-.2h-11Z"
      />
    </svg>
  );
}

/**
 * Connection (name, address, environment), database and collection something acts on, so it can't be
 * mistaken for another one. `children` adds parts at the end (e.g. the shell's query time).
 */
export function WhereBar({
  where,
  className = "",
  children,
}: {
  where: TargetWhere;
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
      <span className="where-part" title="Base de datos">
        <NodeIcon kind="database" size={14} />
        {db}
      </span>
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
