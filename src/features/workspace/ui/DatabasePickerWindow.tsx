import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { TagBadge } from "../../connections/ui/TagBadge";
import { NodeIcon } from "../../explorer/ui/NodeIcon";
import { filterDatabases, type DatabasePickerData, type DatabasePickerResult } from "../domain/databasePicker";
import { ComputerIcon } from "./OpenDatabaseDialog";

interface Props {
  data: DatabasePickerData;
  onDone: (result: DatabasePickerResult | null) => void;
}

/**
 * "Abrir base de datos", the content of its own window: the databases of the connection selected in
 * the tree, which is named once at the top. The arrows move, Enter or a double click opens a shell
 * on the database, Escape closes.
 */
export function DatabasePickerWindow({ data, onDone }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(data.databases[0]);
  const listRef = useRef<HTMLUListElement>(null);

  const visible = useMemo(() => filterDatabases(data.databases, query), [data.databases, query]);
  // The selection follows the filter: it stays when still visible, else falls on the first match.
  const current = visible.includes(selected) ? selected : visible[0];

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [current]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onDone(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  const open = (db = current) => db && onDone({ db });

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const i = current ? visible.indexOf(current) : -1;
    if (e.key === "ArrowDown") setSelected(visible[Math.min(i + 1, visible.length - 1)]);
    else if (e.key === "ArrowUp") setSelected(visible[Math.max(i - 1, 0)]);
    else if (e.key === "Enter") open();
    else return;
    e.preventDefault();
  };

  return (
    <div className="db-dialog">
      <div className="db-picker-connection">
        <span className="db-picker-field" title="Conexión">
          <NodeIcon kind="server" size={14} />
          <b>{data.connection}</b>
          <TagBadge tag={data.tag} />
        </span>
        {data.host && (
          <span className="db-picker-field db-picker-address" title="Host">
            <ComputerIcon />
            {data.host}
          </span>
        )}
        {data.port && (
          <span className="db-picker-field db-picker-address" title="Puerto">
            <PortIcon />
            {data.port}
          </span>
        )}
      </div>
      <input
        autoFocus
        className="search"
        placeholder="Buscar base de datos…"
        aria-label="Buscar base de datos"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <ul className="db-dialog-list" role="listbox" aria-label={`Bases de datos de ${data.connection}`} ref={listRef}>
        {visible.map((db) => (
          <li
            key={db}
            role="option"
            aria-selected={db === current}
            className={db === current ? "active" : ""}
            onClick={() => setSelected(db)}
            onDoubleClick={() => open(db)}
          >
            <NodeIcon kind="database" size={14} />
            <span className="db-name">{db}</span>
            {data.favorites.includes(db) && <StarIcon />}
          </li>
        ))}
        {!visible.length && (
          <li className="db-dialog-empty">
            {data.databases.length ? "No hay bases de datos que coincidan" : "La conexión no tiene bases de datos"}
          </li>
        )}
      </ul>
      <div className="modal-footer">
        <button onClick={() => onDone(null)}>Cerrar</button>
        <span className="spacer" />
        <button className="primary" title="Enter" onClick={() => open()} disabled={!current}>
          Abrir shell
        </button>
      </div>
    </div>
  );
}

/** A plug: the server's port. */
function PortIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <path
        d="M5.5 1.8v3M10.5 1.8v3M3.8 4.8h8.4v2.4a4.2 4.2 0 0 1-8.4 0zM8 11.4v2.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Marks a favorite, as the star of the "Bases de datos" window. */
function StarIcon() {
  return (
    <svg className="db-picker-star" width="13" height="13" viewBox="0 0 16 16" aria-label="Favorita" role="img">
      <path d="M8 1.5l1.9 4.1 4.4.5-3.3 3 .9 4.4L8 11.3l-3.9 2.2.9-4.4-3.3-3 4.4-.5z" fill="currentColor" />
    </svg>
  );
}
