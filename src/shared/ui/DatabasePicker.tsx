import { useState } from "react";
import { selectEverything, type DatabaseCatalog, type Selection } from "../domain/selection";
import { Spinner } from "./common";
import { DatabaseRow } from "./DatabaseRow";

interface Props {
  catalog: DatabaseCatalog[];
  loading: boolean;
  selection: Selection;
  onChange: (selection: Selection) => void;
  /** Heading: "Qué copiar a QA", "Qué guardar"… */
  title: string;
  /** Shown when the origin has no databases. */
  emptyText: string;
  /** Databases that start expanded (the one of the origin collection, or those chosen before "Volver"). */
  initiallyExpanded?: string[];
}

/** The origin's databases, whole or by collection, across several databases (sync, backup and restore). */
export function DatabasePicker({ catalog, loading, selection, onChange, title, emptyText, initiallyExpanded }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(initiallyExpanded));
  const toggleExpanded = (db: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(db)) next.add(db);
      return next;
    });

  return (
    <section className="selection-picker">
      <header>
        <b>{title}</b>
        {loading && <Spinner />}
        <span className="spacer" />
        <button type="button" onClick={() => onChange(selectEverything(catalog))} disabled={!catalog.length}>
          Todas completas
        </button>
        <button type="button" className="link" onClick={() => onChange({})} disabled={!Object.keys(selection).length}>
          Limpiar
        </button>
      </header>
      <p className="muted small">Marca una base de datos para elegirla completa, o despliégala y elige colecciones sueltas.</p>
      {!loading && !catalog.length && <p className="selection-empty">{emptyText}</p>}
      <div className="selection-db-list">
        {catalog.map((database) => (
          <DatabaseRow
            key={database.name}
            database={database}
            selection={selection}
            onChange={onChange}
            expanded={expanded.has(database.name)}
            onToggleExpanded={() => toggleExpanded(database.name)}
          />
        ))}
      </div>
    </section>
  );
}
