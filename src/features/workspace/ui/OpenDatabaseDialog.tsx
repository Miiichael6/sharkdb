import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { errorMessage } from "../../../shared/errors";
import {
  EMPTY_SERVER_NOTE,
  MANDATORY_NOTE,
  type OpenDatabaseData,
  type OpenDatabaseResult,
} from "../domain/databaseChoice";
import { CreateDatabaseForm } from "./CreateDatabaseForm";
import { DatabaseChoiceRow } from "./DatabaseChoiceRow";
import { useOpenDatabaseForm } from "./useOpenDatabaseForm";

interface Props {
  data: OpenDatabaseData;
  onFavorites: (favorites: string[]) => Promise<void>;
  onCreate: (db: string, coll: string) => Promise<void>;
  onDone: (result: OpenDatabaseResult | null) => void;
}

/**
 * "Bases de datos", the content of its own window: every database of one connection, with a star
 * that makes it a favorite and a check per database the explorer shows: it opens with the explorer's
 * current list checked, and Abrir applies it (new ones open as temporary, unchecked ones leave). A
 * favorite stays checked while it has its star. A click only checks or unchecks its row (Shift adds a
 * range); the arrows move, Space toggles; Escape closes unless the choice is mandatory.
 */
export function OpenDatabaseDialog({ data, onFavorites, onCreate, onDone }: Props) {
  const [error, setError] = useState("");
  const form = useOpenDatabaseForm({ data, onFavorites, onError: (e) => setError(errorMessage(e)) });
  const [creating, setCreating] = useState(form.emptyServer);
  const listRef = useRef<HTMLUListElement>(null);
  const { anchor } = form.selection;

  useEffect(() => {
    listRef.current?.querySelector(".anchor")?.scrollIntoView({ block: "nearest" });
  }, [anchor]);

  useEffect(() => {
    if (data.mandatory) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onDone(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone, data.mandatory]);

  const open = (databases = form.checked) => onDone({ databases });
  const canOpen = form.checked.length > 0;

  const create = async (db: string, coll: string) => {
    await onCreate(db, coll);
    open([...form.checked, db]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") form.move(1);
    else if (e.key === "ArrowUp") form.move(-1);
    else if (e.key === " " && anchor && !form.query) form.toggle(anchor);
    else if (e.key === "Enter" && canOpen) open();
    else return;
    e.preventDefault();
  };

  return (
    <div className="db-dialog">
      <p className="db-dialog-connection">
        Conexión: <b>{data.connection}</b>
      </p>
      {data.mandatory && <p className="db-dialog-note">{MANDATORY_NOTE}</p>}
      {creating ? (
        <>
          {form.emptyServer && <p className="db-dialog-note">{EMPTY_SERVER_NOTE}</p>}
          <CreateDatabaseForm onCreate={create} onCancel={() => setCreating(false)} />
        </>
      ) : (
        <>
          <input
            autoFocus
            className="search"
            placeholder="Buscar base de datos…"
            aria-label="Buscar base de datos"
            value={form.query}
            onChange={(e) => form.setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <ul className="db-dialog-list" role="listbox" aria-label="Bases de datos" aria-multiselectable ref={listRef}>
            {form.rows.map((name) => (
              <DatabaseChoiceRow
                key={name}
                name={name}
                favorite={form.favorites.includes(name)}
                checked={form.isChecked(name)}
                anchor={name === anchor}
                missing={form.isMissing(name)}
                onClick={(e) => form.click(name, e)}
                onToggle={() => form.toggle(name)}
                onToggleStar={() => form.toggleStar(name)}
              />
            ))}
            {!form.rows.length && (
              <li className="db-dialog-empty">
                {form.emptyServer ? EMPTY_SERVER_NOTE : "No hay bases de datos que coincidan"}
              </li>
            )}
          </ul>
        </>
      )}
      {error && <p className="danger-text">{error}</p>}
      <div className="modal-footer">
        <button onClick={() => onDone(null)}>{data.mandatory ? "Cancelar" : "Cerrar"}</button>
        <span className="spacer" />
        {!creating && form.canClear && <button onClick={form.clear}>Desmarcar</button>}
        {!creating && <button onClick={() => setCreating(true)}>Crear base de datos…</button>}
        {!creating && (
          <button className="primary" onClick={() => open()} disabled={!canOpen}>
            {canOpen ? `Abrir (${form.checked.length})` : "Abrir"}
          </button>
        )}
      </div>
    </div>
  );
}
