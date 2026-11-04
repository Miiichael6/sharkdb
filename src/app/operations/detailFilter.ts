// Filter of the operation detail: the same matching as the explorer's (every word, without case or accents).
import { isFilterActive, matchName } from "../../features/explorer/domain/collectionFilter";
import type { CollectionProgressEntry, DatabaseGroup } from "../../shared/domain/collectionProgress";

/** A database of the detail and the collections of it that the filter lets through. */
export interface FilteredGroup {
  group: DatabaseGroup;
  shown: CollectionProgressEntry[];
}

/**
 * The databases with something matching `query`: a database whose name matches shows all its
 * collections; otherwise only the matching ones, and it's left out when none does.
 */
export function filterGroups(groups: DatabaseGroup[], query: string): FilteredGroup[] {
  if (!isFilterActive(query)) return groups.map((group) => ({ group, shown: group.collections }));
  return groups
    .map((group) => ({
      group,
      shown: matchName(group.db, query) ? group.collections : group.collections.filter((c) => matchName(c.collection, query)),
    }))
    .filter(({ shown }) => shown.length > 0);
}
