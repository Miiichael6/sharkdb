// State of the "Bases de datos" window: search, stars and multiple selection.
import { useMemo, useState, type MouseEvent } from "react";
import { orderForDialog, toggleFavorite } from "../../explorer/domain/pinnedDatabases";
import {
  clickRow,
  moveAnchor,
  NO_SELECTION,
  toggleRow,
  type ListSelection,
  type OpenDatabaseData,
} from "../domain/databaseChoice";

interface Options {
  data: OpenDatabaseData;
  /** Saves the stars right away, so they stay even if the window is cancelled. */
  onFavorites: (favorites: string[]) => Promise<void>;
  onError: (e: unknown) => void;
}

export function useOpenDatabaseForm({ data, onFavorites, onError }: Options) {
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState(data.favorites);
  // Holds the checked rows that aren't favorites: a favorite is always checked (its star keeps it in the explorer).
  const [selection, setSelection] = useState<ListSelection>(() => ({
    ...NO_SELECTION,
    selected: data.shown.filter((name) => !data.favorites.includes(name)),
  }));
  // Computed once: marking a star doesn't move its row until the window opens again.
  const [order] = useState(() => orderForDialog(data.databases, data.favorites));
  const existing = useMemo(() => new Set(data.databases), [data.databases]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? order.filter((name) => name.toLowerCase().includes(q)) : order;
  }, [order, query]);

  const isChecked = (name: string) => favorites.includes(name) || selection.selected.includes(name);
  const checked = order.filter(isChecked);

  const toggleStar = (name: string) => {
    const next = toggleFavorite(favorites, name);
    // Losing its star leaves the row checked: it stays in the explorer until it's unchecked.
    if (!next.includes(name)) setSelection((s) => (s.selected.includes(name) ? s : { ...s, selected: [...s.selected, name] }));
    setFavorites(next);
    onFavorites(next).catch((e) => {
      setFavorites(favorites);
      onError(e);
    });
  };

  const click = (name: string, e: MouseEvent) => {
    if (!e.shiftKey && favorites.includes(name)) return;
    setSelection((s) => clickRow(rows, s, name, e.shiftKey));
  };

  /** Arrow keys move the anchor only: the checked rows stay as they are, Space toggles. */
  const move = (step: number) => {
    const name = moveAnchor(rows, selection, step);
    if (name) setSelection((s) => ({ ...s, anchor: name }));
  };

  return {
    query,
    setQuery,
    rows,
    favorites,
    selection,
    checked,
    isChecked,
    isMissing: (name: string) => !existing.has(name),
    toggleStar,
    click,
    toggle: (name: string) => !favorites.includes(name) && setSelection((s) => toggleRow(s, name)),
    /** Some row can be unchecked: the favorites can't. */
    canClear: selection.selected.some((name) => !favorites.includes(name)),
    /** Unchecks every row but the favorites. */
    clear: () => setSelection((s) => ({ ...s, selected: [] })),
    move,
    emptyServer: !data.databases.length,
  };
}
