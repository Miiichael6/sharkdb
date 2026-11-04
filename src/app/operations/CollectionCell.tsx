import {
  collectionDescription,
  collectionPercent,
  collectionStatusLabel,
  duplicatesLabel,
  type CollectionProgressEntry,
} from "../../shared/domain/collectionProgress";
import type { OperationKind } from "../../shared/domain/operations";
import { HighlightedLabel } from "../../features/explorer/ui/HighlightedLabel";
import { CollectionStatusDot } from "./CollectionStatusDot";

interface Props {
  entry: CollectionProgressEntry;
  kind: OperationKind;
  /** Documents a restore skipped because their `_id` was already there. */
  duplicates: number;
  /** The detail's filter, highlighted in the name. */
  query: string;
}

/** One collection of the detail: dot, name and 0–100 %; the error under it when it failed (R92). */
export function CollectionCell({ entry, kind, duplicates, query }: Props) {
  const failed = entry.status === "failed" && entry.error;
  return (
    <li className={`ops-cell ${entry.status}`} title={collectionDescription(entry, kind, duplicates)}>
      <CollectionStatusDot status={entry.status} label={collectionStatusLabel(entry.status, kind)} />
      <span className="ops-cell-name">
        <HighlightedLabel label={entry.collection} query={query} />
      </span>
      {duplicates > 0 && <span className="ops-cell-duplicates small">{duplicatesLabel(duplicates)}</span>}
      <span className="ops-cell-percent small">{collectionPercent(entry)} %</span>
      {failed && <span className="ops-cell-error small">{entry.error}</span>}
    </li>
  );
}
