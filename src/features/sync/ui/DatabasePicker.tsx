import { useState } from "react";
import { Spinner } from "../../../shared/ui/common";
import { selectEverything, type DatabaseCatalog, type Selection } from "../domain/syncPlan";
import { DatabaseRow } from "./DatabaseRow";

interface Props {
  catalog: DatabaseCatalog[];
  loading: boolean;
  selection: Selection;
  onChange: (selection: Selection) => void;
  /** Where the copy goes, for the heading. */
  targetName: string;
  /** Opened from a collection: its database starts expanded. */
  initiallyExpanded?: string;
  disabled: boolean;
}

/** "Qué copiar": the source's databases, whole or by collection, across several databases. */
export function DatabasePicker({ catalog, loading, selection, onChange, targetName, initiallyExpanded, disabled }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(initiallyExpanded ? [initiallyExpanded] : []));
  const toggleExpanded = (db: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(db)) next.add(db);
      return next;
    });

  return (
    <section className="sync-picker">
      <header>
        <b>Qué copiar{targetName && ` a ${targetName}`}</b>
        {loading && <Spinner />}
        <span className="spacer" />
        <button type="button" onClick={() => onChange(selectEverything(catalog))} disabled={disabled || !catalog.length}>
          Todas completas
        </button>
        <button type="button" className="link" onClick={() => onChange({})} disabled={disabled || !Object.keys(selection).length}>
          Limpiar
        </button>
      </header>
      <p className="muted small">Marca una base de datos para copiarla completa, o despliégala y elige colecciones sueltas.</p>
      {!loading && !catalog.length && <p className="sync-plan-empty">La conexión de origen no tiene bases de datos que copiar</p>}
      <div className="sync-db-list">
        {catalog.map((database) => (
          <DatabaseRow
            key={database.name}
            database={database}
            selection={selection}
            onChange={onChange}
            expanded={expanded.has(database.name)}
            onToggleExpanded={() => toggleExpanded(database.name)}
            disabled={disabled}
          />
        ))}
      </div>
    </section>
  );
}
