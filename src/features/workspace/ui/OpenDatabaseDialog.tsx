import { useEffect, useRef, useState } from "react";
import { errorMessage } from "../../../shared/errors";
import {
  EMPTY_SERVER_NOTE,
  MANDATORY_NOTE,
  type OpenDatabaseData,
  type OpenDatabaseResult,
} from "../domain/databaseChoice";
import { NodeIcon } from "../../explorer/ui/NodeIcon";
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
 * range); the arrows move, Enter or Space toggles (never a favorite: only its star frees it),
 * Ctrl+Enter opens; Escape closes unless the choice is mandatory.
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

  /**
   * The list's keys, wherever the focus is (a click on a row leaves the search): the arrows move,
   * Enter or Space checks the row, Ctrl+Enter opens. Enter opens too while no row is chosen.
   */
  const onKeyDown = (e: globalThis.KeyboardEvent) => {
    if (creating) return;
    const target = e.target as HTMLElement;
    const inSearch = target.classList.contains("search");
    // Buttons, checkboxes and other fields keep their own Enter and Space.
    if (!inSearch && target.matches("button, input, textarea, select") && !e.key.startsWith("Arrow")) return;
    if (e.key === "ArrowDown") form.move(1);
    else if (e.key === "ArrowUp") form.move(-1);
    else if (e.key === "Enter" && (e.ctrlKey || !anchor)) canOpen && open();
    else if ((e.key === "Enter" || (e.key === " " && !(inSearch && form.query))) && anchor) form.toggle(anchor);
    else return;
    e.preventDefault();
  };
  const keyHandler = useRef(onKeyDown);
  keyHandler.current = onKeyDown;

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="db-dialog">
      <div className="db-dialog-connection">
        <span className="db-dialog-target">
          Conexión:
          <NodeIcon kind="server" size={14} />
          <b>{data.connection}</b>
          {data.host && data.host !== data.connection && (
            <span className="db-dialog-host">
              <ComputerIcon />
              {data.host}
            </span>
          )}
        </span>
        {!creating && form.rows.length > 0 && (
          <button type="button" className="db-toggle-all"
            onClick={form.toggleAll}
            // Only favorites left checked: their star keeps them, there's nothing to uncheck.
            disabled={form.allChecked && !form.rows.some((name) => form.selection.selected.includes(name))}
          >
            <CheckAllIcon checked={form.allChecked} />
            {form.allChecked ? "Desmarcar todos" : "Marcar todos"}
          </button>
        )}
      </div>
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
        {!creating && <button onClick={() => setCreating(true)}>Crear base de datos…</button>}
        {!creating && (
          <button className="primary" title="Ctrl+Enter" onClick={() => open()} disabled={!canOpen}>
            {canOpen ? `Abrir (${form.checked.length})` : "Abrir"}
          </button>
        )}
      </div>
    </div>
  );
}

/** A monitor on its stand: the server's address. */
export function ComputerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <rect x="1.8" y="2.5" width="12.4" height="8.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 11v2.5M5 13.5h6" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/** A box with a check to mark every row, an empty box once they all are (the button unchecks). */
function CheckAllIcon({ checked }: { checked: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <rect x="2" y="2" width="12" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      {!checked && (
        <path d="M5 8.2l2 2 4-4.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}
