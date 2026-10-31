import { useState } from "react";
import { collectionsLabel } from "../domain/jobs";
import { formatBytes } from "../format";
import { TriStateCheckbox } from "./TriStateCheckbox";
import { databaseState, filterCollections, toggleCollection, toggleDatabase, type DatabaseCatalog, type Selection } from "../domain/selection";

interface Props {
  database: DatabaseCatalog;
  selection: Selection;
  onChange: (selection: Selection) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}

/** One database of the origin: its checkbox copies it whole; expanded, single collections are chosen. */
export function DatabaseRow({ database, selection, onChange, expanded, onToggleExpanded }: Props) {
  const [query, setQuery] = useState("");
  const state = databaseState(selection, database);
  const chosen = selection[database.name] ?? [];
  const empty = !database.collections.length;

  return (
    <div className={`selection-db ${state}${expanded ? " expanded" : ""}`}>
      <div className="selection-db-row">
        <TriStateCheckbox
          state={state}
          onChange={() => onChange(toggleDatabase(selection, database))}
          disabled={empty}
          aria-label={`Elegir ${database.name} completa`}
        />
        <b className="selection-db-name" onClick={() => !empty && onChange(toggleDatabase(selection, database))}>
          {database.name}
        </b>
        <span className="muted small">
          {collectionsLabel(database.collections.length)} · {formatBytes(database.sizeOnDisk)}
        </span>
        {state === "partial" && <span className="selection-db-count">{chosen.length} elegidas</span>}
        <span className="spacer" />
        {!empty && (
          <button type="button" className="selection-db-expand" onClick={onToggleExpanded} aria-expanded={expanded}>
            {expanded ? "▾ Ocultar" : "▸ Por colección"}
          </button>
        )}
      </div>
      {expanded && (
        <div className="selection-db-collections">
          <input
            placeholder="Filtrar colecciones…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            spellCheck={false}
          />
          <div className="selection-db-grid">
            {filterCollections(database.collections, query).map((name) => (
              <label key={name} className="check" title={name}>
                <input
                  type="checkbox"
                  checked={chosen.includes(name)}
                  onChange={() => onChange(toggleCollection(selection, database, name))}
                />
                <span>{name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
