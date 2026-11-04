import { useId, useState } from "react";
import {
  collectionDuplicates,
  collectionStatusLabel,
  copySummaryLabel,
  databaseSummary,
  databaseSummaryLabel,
  opensByDefault,
  type CollectionPhase,
  type CollectionProgressEntry,
  type DatabaseGroup,
} from "../../shared/domain/collectionProgress";
import { isFilterActive } from "../../features/explorer/domain/collectionFilter";
import { HighlightedLabel } from "../../features/explorer/ui/HighlightedLabel";
import type { CollectionResult } from "../../shared/domain/jobs";
import type { OperationKind } from "../../shared/domain/operations";
import { CollectionCell } from "./CollectionCell";
import { CollectionStatusDot } from "./CollectionStatusDot";

interface Props {
  /** The whole database: its title sums all of it up, even while filtering. */
  group: DatabaseGroup;
  /** Its collections that the filter lets through. */
  shown: CollectionProgressEntry[];
  /** The detail's filter: while there is one, the databases with matches are open. */
  query: string;
  kind: OperationKind;
  results: CollectionResult[];
  /** How many databases the operation goes through: the only one is always open. */
  databaseCount: number;
  /** In the copy phase nothing is finished yet, so its title doesn't count finished ones. */
  phase?: CollectionPhase;
}

/**
 * A database of the detail, foldable, with its summary as title (R91). It opens and folds by
 * itself as the work moves on (in course or with an error: open) until it's toggled by hand.
 */
export function DatabaseSection({ group, shown, query, kind, results, databaseCount, phase }: Props) {
  const summary = databaseSummary(group);
  const [chosen, setChosen] = useState<boolean | null>(null);
  const open = chosen ?? (isFilterActive(query) || opensByDefault(summary, databaseCount));
  const listId = useId();
  const state = collectionStatusLabel(summary.worst, kind);

  return (
    <section className="ops-db">
      <button type="button" className="ops-db-head" aria-expanded={open} aria-controls={listId} onClick={() => setChosen(!open)}>
        <span className="ops-caret" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
        <span className="ops-db-name ellipsis" title={group.db}>
          <HighlightedLabel label={group.db} query={query} />
        </span>
        <span className="ops-db-summary small">{phase === "copy" ? copySummaryLabel(summary) : databaseSummaryLabel(summary)}</span>
        <CollectionStatusDot status={summary.worst} label={state} />
      </button>
      {open && (
        <ul id={listId} className="ops-cells">
          {shown.map((entry) => (
            <CollectionCell
              key={entry.collection}
              entry={entry}
              kind={kind}
              duplicates={collectionDuplicates(entry, results)}
              query={query}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
