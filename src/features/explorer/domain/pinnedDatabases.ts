// Which databases the explorer shows for a connection: its favorites (saved with the connection)
// and the temporary ones opened during this run. Pure, no IO.
import { favoritesFirst } from "../../../shared/domain/favoritesFirst";
import { isSystemDatabase, userDatabases, type DatabaseEntry } from "./mongo";

/** A database of the explorer; `missing` when it's a favorite the server no longer has. */
export interface VisibleDatabase extends DatabaseEntry {
  missing: boolean;
}

/** Shown on a favorite the server no longer has. */
export const MISSING_DATABASE = "Ya no existe en el servidor";

const alphabetical = (a: string, b: string) => a.localeCompare(b);

/**
 * The databases to show, alphabetical and without repeats: every favorite (a missing one too, so it
 * can be unmarked), the temporary ones that still exist on the server and, always, the system ones
 * the server has (they go in the System folder, as in Robo 3T).
 */
export function visibleDatabases(favorites: string[], temporaries: string[], existing: DatabaseEntry[]): VisibleDatabase[] {
  const byName = new Map(existing.map((d) => [d.name, d]));
  const system = existing.map((d) => d.name).filter(isSystemDatabase);
  const names = new Set([...userDatabases(favorites), ...temporaries.filter((t) => byName.has(t)), ...system]);
  return [...names].sort(alphabetical).map((name) => {
    const entry = byName.get(name);
    return entry ? { ...entry, missing: false } : { name, sizeOnDisk: 0, empty: true, missing: true };
  });
}

/** Whether the connection shows some database of the user's own: system ones don't count, they're always there. */
export const hasUserDatabases = (favorites: string[], temporaries: string[]) => userDatabases([...favorites, ...temporaries]).length > 0;

/** Marks `name` as favorite, or unmarks it if it was; the list stays alphabetical. */
export function toggleFavorite(favorites: string[], name: string): string[] {
  return favorites.includes(name) ? favorites.filter((f) => f !== name) : [...favorites, name].sort(alphabetical);
}

/** What the explorer must change so it shows exactly `checked` (plus the favorites, which always stay). */
export function listChanges(checked: string[], favorites: string[], temporaries: string[]) {
  return {
    open: checked.filter((name) => !favorites.includes(name) && !temporaries.includes(name)),
    close: temporaries.filter((name) => !checked.includes(name)),
  };
}

/**
 * Order of the "Bases de datos" window, computed once when it opens: the favorites at that moment
 * first (also those the server no longer has), then the rest, each group alphabetical. Marking a
 * star afterwards doesn't move the row.
 */
export const orderForDialog = (all: string[], favoritesAtOpen: string[]): string[] =>
  [...new Set([...favoritesAtOpen, ...all])].sort(favoritesFirst(favoritesAtOpen));
