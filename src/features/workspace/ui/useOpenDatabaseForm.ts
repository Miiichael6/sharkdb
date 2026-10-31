// State of the "Bases de datos" window: search, stars and multiple selection.
import { useMemo, useState, type MouseEvent } from "react";
import { orderForDialog, toggleFavorite } from "../../explorer/domain/pinnedDatabases";
import {
  clickRow,
  moveAnchor,
  NO_SELECTION,
  selectOnly,
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
  const [selection, setSelection] = useState<ListSelection>(NO_SELECTION);
  // Computed once: marking a star doesn't move its row until the window opens again.
  const [order] = useState(() => orderForDialog(data.databases, data.favorites));
  const existing = useMemo(() => new Set(data.databases), [data.databases]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? order.filter((name) => name.toLowerCase().includes(q)) : order;
  }, [order, query]);

  const toggleStar = (name: string) => {
    const next = toggleFavorite(favorites, name);
    setFavorites(next);
    onFavorites(next).catch((e) => {
      setFavorites(favorites);
      onError(e);
    });
  };

  const click = (name: string, e: MouseEvent) =>
    setSelection((s) => clickRow(rows, s, name, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey }));

  /** Arrow keys: the selection follows the anchor. */
  const move = (step: number) => {
    const name = moveAnchor(rows, selection, step);
    if (name) setSelection(selectOnly(name));
  };

  return {
    query,
    setQuery,
    rows,
    favorites,
    selection,
    isMissing: (name: string) => !existing.has(name),
    toggleStar,
    click,
    toggle: (name: string) => setSelection((s) => toggleRow(s, name)),
    move,
    emptyServer: !data.databases.length,
  };
}
