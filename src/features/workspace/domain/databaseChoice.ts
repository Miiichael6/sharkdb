// "Bases de datos" window: what it receives, asks and answers, and its multiple selection. Pure, no React.

/** What the window shows: every database of one connection and which ones are favorites. */
export interface OpenDatabaseData {
  /** Name of the connection, shown at the top. */
  connection: string;
  /** Every database of the server. */
  databases: string[];
  favorites: string[];
  /** The user databases the explorer shows now (favorites and temporary): they start checked. */
  shown: string[];
  /** The connection has nothing to show yet: there is no X or Escape, and Cancelar closes the connection. */
  mandatory: boolean;
}

/** What the window asks its opener while open. */
export type OpenDatabaseRequest =
  | { kind: "favorites"; favorites: string[] }
  /** MongoDB creates a database with its first collection. */
  | { kind: "create"; db: string; coll: string };

/** The databases the explorer must show: every checked row, favorites included. Closing gives null instead. */
export interface OpenDatabaseResult {
  databases: string[];
}

export const MANDATORY_NOTE = "Elige al menos una base de datos para ver esta conexión en el explorador.";
export const EMPTY_SERVER_NOTE = "El servidor no tiene bases de datos: crea una para empezar.";
export const NO_CONNECTION_SELECTED = "Selecciona una conexión en el explorador";

/** Chosen rows plus the anchor that Shift extends from (also the row the arrows move). */
export interface ListSelection {
  selected: string[];
  anchor?: string;
}

export const NO_SELECTION: ListSelection = { selected: [] };

/** Adds or removes `name`, as a click on its row or its checkbox does. */
export function toggleRow(selection: ListSelection, name: string): ListSelection {
  const selected = selection.selected.includes(name)
    ? selection.selected.filter((s) => s !== name)
    : [...selection.selected, name];
  return { selected, anchor: name };
}

/** A click on a row of `rows` (in display order): it toggles the row, or with Shift adds the range from the anchor. */
export function clickRow(rows: string[], selection: ListSelection, name: string, shift: boolean): ListSelection {
  const from = selection.anchor ? rows.indexOf(selection.anchor) : -1;
  if (!shift || from < 0) return toggleRow(selection, name);
  const to = rows.indexOf(name);
  const range = rows.slice(Math.min(from, to), Math.max(from, to) + 1);
  return { selected: [...new Set([...selection.selected, ...range])], anchor: selection.anchor };
}

/** The row `step` places away from the anchor (or the first one), kept inside the list. */
export function moveAnchor(rows: string[], selection: ListSelection, step: number): string | undefined {
  const at = selection.anchor ? rows.indexOf(selection.anchor) : -1;
  if (at < 0) return rows[0];
  return rows[Math.min(Math.max(at + step, 0), rows.length - 1)];
}
