import { byDatabase, inPhase, type CollectionPhase, type CollectionProgressEntry } from "../../shared/domain/collectionProgress";
import type { CollectionResult } from "../../shared/domain/jobs";
import type { OperationKind } from "../../shared/domain/operations";
import { DatabaseList } from "./DatabaseList";

const PHASES: Record<CollectionPhase, { title: string; hint: string; empty: string }> = {
  copy: {
    title: "1 · Copia provisional",
    hint: "Se copia cada colección a una provisional en el destino; el destino aún no cambia.",
    empty: "Nada por copiar",
  },
  replace: {
    title: "2 · Reemplazo",
    hint: "Al terminar la copia de todas, las provisionales reemplazan a las del destino.",
    empty: "Aún no hay colecciones copiadas",
  },
};

interface Props {
  phase: CollectionPhase;
  collections: CollectionProgressEntry[];
  query: string;
  kind: OperationKind;
  results: CollectionResult[];
  /** What the list says when the filter hides everything of this phase. */
  noMatches: string;
  databaseCount: number;
}

/** One phase of a sync or restore with its collections by database; they pass from the first to the second. */
export function PhaseSection({ phase, collections, query, kind, results, noMatches, databaseCount }: Props) {
  const entries = inPhase(collections, phase);
  const { title, hint, empty } = PHASES[phase];
  return (
    <section className={`ops-phase ${phase}`} aria-label={title}>
      <h3 className="ops-phase-head" title={hint}>
        <span>{title}</span>
        <span className="ops-phase-count muted small">{entries.length}</span>
      </h3>
      <div className="ops-detail-dbs">
        <DatabaseList
          groups={byDatabase(entries)}
          query={query}
          kind={kind}
          results={results}
          empty={entries.length ? noMatches : empty}
          phase={phase}
          databaseCount={databaseCount}
        />
      </div>
    </section>
  );
}
