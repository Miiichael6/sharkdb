import type { CollectionPhase, DatabaseGroup } from "../../shared/domain/collectionProgress";
import type { CollectionResult } from "../../shared/domain/jobs";
import type { OperationKind } from "../../shared/domain/operations";
import { DatabaseSection } from "./DatabaseSection";
import { filterGroups } from "./detailFilter";

interface Props {
  groups: DatabaseGroup[];
  query: string;
  kind: OperationKind;
  results: CollectionResult[];
  /** What it says when there is nothing to show (no collections, or none matching). */
  empty: string;
  phase?: CollectionPhase;
  /** How many databases the whole operation goes through (a phase may hold only some of them). */
  databaseCount: number;
}

/** The databases of the detail that the filter lets through, each one foldable. */
export function DatabaseList({ groups, query, kind, results, empty, phase, databaseCount }: Props) {
  const filtered = filterGroups(groups, query);
  if (!filtered.length) return <p className="muted small ops-detail-empty">{empty}</p>;
  return (
    <>
      {filtered.map(({ group, shown }) => (
        <DatabaseSection
          key={group.db}
          group={group}
          shown={shown}
          query={query}
          kind={kind}
          results={results}
          databaseCount={databaseCount}
          phase={phase}
        />
      ))}
    </>
  );
}
