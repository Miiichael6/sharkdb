import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Avatar } from "../../../shared/ui/common";
import { displayName, hostLabel, type MongoConnection } from "../domain/connection";
import { TagBadge } from "./TagBadge";

export const OPEN_CONNECTION_VIEW = "open-connection";

export interface OpenConnectionData {
  connections: MongoConnection[];
  /** Connections with an open session, marked as online. */
  openIds: string[];
}

/** What the window ended with: a connection to open, or "Nueva…". */
export type OpenConnectionResult = { kind: "open"; id: string } | { kind: "new" };

interface Props {
  data: OpenConnectionData;
  onDone: (result: OpenConnectionResult | null) => void;
}

/**
 * "Abrir conexión", the content of its own window: searchable list of the saved connections.
 * The arrows move, Enter or a double click opens, Ctrl+F goes to the search, Escape closes.
 */
export function OpenConnectionDialog({ data: { connections, openIds }, onDone }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(connections[0]?.id);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return connections;
    return connections.filter((c) => [displayName(c), hostLabel(c), c.tag].some((s) => s.toLowerCase().includes(q)));
  }, [connections, query]);
  // The selection follows the filter: it stays when still visible, else falls on the first match.
  const current = visible.find((c) => c.id === selected) ?? visible[0];

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [current?.id]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onDone(null);
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  const open = (id = current?.id) => id && onDone({ kind: "open", id });

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const i = current ? visible.indexOf(current) : -1;
    if (e.key === "ArrowDown") setSelected(visible[Math.min(i + 1, visible.length - 1)]?.id);
    else if (e.key === "ArrowUp") setSelected(visible[Math.max(i - 1, 0)]?.id);
    else if (e.key === "Enter") open();
    else return;
    e.preventDefault();
  };

  return (
    <div className="db-dialog">
      <input
        autoFocus
        ref={searchRef}
        className="search"
        placeholder="Buscar conexión… (Ctrl F)"
        aria-label="Buscar conexión"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <ul className="db-dialog-list conn-dialog-list" role="listbox" aria-label="Conexiones" ref={listRef}>
        {visible.map((c) => (
          <li
            key={c.id}
            role="option"
            aria-selected={c === current}
            className={c === current ? "active" : ""}
            onClick={() => setSelected(c.id)}
            onDoubleClick={() => open(c.id)}
          >
            <Avatar color={c.color} size={26} />
            <div className="conn-text">
              <div className="conn-title">
                <span>{displayName(c)}</span>
                <TagBadge tag={c.tag} />
                {openIds.includes(c.id) && <span className="online" title="Conectada" />}
              </div>
              <span className="conn-host">{hostLabel(c)}</span>
            </div>
          </li>
        ))}
        {!visible.length && (
          <li className="db-dialog-empty">{connections.length ? "Ninguna conexión coincide" : "Todavía no hay conexiones"}</li>
        )}
      </ul>
      <div className="modal-footer">
        <button onClick={() => onDone(null)}>Cerrar</button>
        <span className="spacer" />
        <button onClick={() => onDone({ kind: "new" })}>Nueva…</button>
        <button className="primary" onClick={() => open()} disabled={!current}>
          Abrir
        </button>
      </div>
    </div>
  );
}
