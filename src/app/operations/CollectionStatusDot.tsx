import type { CollectionStatus } from "../../shared/domain/collectionProgress";

/** The coloured dot of a collection state (D23), named for screen readers: it's never the colour alone (R96). */
export function CollectionStatusDot({ status, label }: { status: CollectionStatus; label: string }) {
  return <span className={`ops-dot ${status}`} role="img" aria-label={label} />;
}
