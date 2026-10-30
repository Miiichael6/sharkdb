import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { NodeIcon } from "../../explorer/ui/NodeIcon";

export interface DatabaseChoice {
  key: string;
  name: string;
  current: boolean;
}

/** What the dialog ended with: a database to open, or "Nueva…". */
export type OpenDatabaseResult = { kind: "open"; key: string } | { kind: "new" };

interface Props {
  databases: DatabaseChoice[];
  onDone: (result: OpenDatabaseResult | null) => void;
}

/**
 * "Bases de datos", the content of its own window: searchable list of the active session's
 * databases, the current one selected. The arrows move, Enter or a double click opens, Escape closes.
 */
export function OpenDatabaseDialog({ databases, onDone }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => databases.find((d) => d.current)?.key);
  const listRef = useRef<HTMLUListElement>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? databases.filter((d) => d.name.toLowerCase().includes(q)) : databases;
  }, [databases, query]);
  // The selection follows the filter: it stays when still visible, else falls on the first match.
  const current = visible.find((d) => d.key === selected) ?? visible[0];

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [current?.key]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onDone(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  const open = (key = current?.key) => key && onDone({ kind: "open", key });

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const i = current ? visible.indexOf(current) : -1;
    if (e.key === "ArrowDown") setSelected(visible[Math.min(i + 1, visible.length - 1)]?.key);
    else if (e.key === "ArrowUp") setSelected(visible[Math.max(i - 1, 0)]?.key);
    else if (e.key === "Enter") open();
    else return;
    e.preventDefault();
  };

  return (
    <div className="db-dialog">
      <input
        autoFocus
        className="search"
        placeholder="Buscar base de datos…"
        aria-label="Buscar base de datos"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <ul className="db-dialog-list" role="listbox" aria-label="Bases de datos" ref={listRef}>
        {visible.map((d) => (
          <li
            key={d.key}
            role="option"
            aria-selected={d === current}
            className={d === current ? "active" : ""}
            onClick={() => setSelected(d.key)}
            onDoubleClick={() => open(d.key)}
          >
            <NodeIcon kind="database" />
            <span>{d.name}</span>
          </li>
        ))}
        {!visible.length && (
          <li className="db-dialog-empty">
            {databases.length ? "No hay bases de datos que coincidan" : "No hay bases de datos cargadas"}
          </li>
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
