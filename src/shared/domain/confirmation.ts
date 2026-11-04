// A yes/no question shown before an action that can't be undone.
import type { TargetWhere } from "./documentTarget";

/** One line of what is about to change, shown under the message: `Campo  EECC.RUC`. */
export interface ConfirmDetail {
  label: string;
  value: string;
}

/** A small comparison under the detail lines: a header row, then one row per compared thing. */
export interface ConfirmTable {
  /** Header of each value column (the first column holds the row labels). */
  columns: string[];
  rows: { label: string; cells: string[] }[];
}

export interface ConfirmRequest {
  /** Title of the window. */
  title: string;
  message: string;
  details?: ConfirmDetail[];
  table?: ConfirmTable;
  /** The go-ahead button only saves (not red): nothing is lost by pressing it. */
  safe?: boolean;
  /** Enter presses the back-out button, which then is the one that keeps things as they are. */
  focusDismiss?: boolean;
  /** Label of the button that goes ahead. */
  confirmLabel: string;
  /** Label of the button that backs out (`DISMISS_LABEL` by default). */
  dismissLabel?: string;
  /** Connection, database and collection it acts on, shown over the message. */
  where?: TargetWhere;
}

export const DISMISS_LABEL = "Cancelar";

/**
 * Asked when the user clicks elsewhere while editing a value in place (D22): by default it keeps
 * editing, so a stray click doesn't throw away what was typed.
 */
export const leaveInlineEditRequest = (field: string): ConfirmRequest => ({
  title: "Edición en curso",
  message: `Estás editando el campo ${field}. ¿Descartar los cambios?`,
  confirmLabel: "Descartar cambios",
  dismissLabel: "Seguir editando",
  focusDismiss: true,
});

/** Asked when Escape would close an editor with changes nobody saved. */
export const discardChangesRequest = (what: string): ConfirmRequest => ({
  title: "Cambios sin guardar",
  message: `${what} tiene cambios sin guardar. ¿Cerrar y descartarlos?`,
  confirmLabel: "Descartar",
});

export const CONFIRM_WINDOW_WIDTH = 440;
/** Wide enough for the connection, address, database and collection on one line. */
export const CONFIRM_WHERE_WINDOW_WIDTH = 600;

// Rough text metrics of the window's message, to fit its height to it.
const CHARS_PER_LINE = 52;
const LINE_HEIGHT = 20;
const CHROME_HEIGHT = 120;
const MAX_LINES = 12;
const WHERE_HEIGHT = 34;
const DETAIL_HEIGHT = 22;
const DETAILS_MARGIN = 10;
const TABLE_ROW_HEIGHT = 26;
const TABLE_MARGIN = 12;

/** Height of a confirmation window that shows `message` without scrolling (long ones are capped). */
export function confirmWindowHeight({ message, where, details = [], table }: Pick<ConfirmRequest, "message" | "where" | "details" | "table">): number {
  const lines = message
    .split("\n")
    .reduce((n, line) => n + Math.max(1, Math.ceil(line.length / CHARS_PER_LINE)), 0);
  const detailsHeight = details.length ? DETAILS_MARGIN + details.length * DETAIL_HEIGHT : 0;
  // The header row plus one per compared thing.
  const tableHeight = table ? TABLE_MARGIN + (table.rows.length + 1) * TABLE_ROW_HEIGHT : 0;
  return CHROME_HEIGHT + Math.min(lines, MAX_LINES) * LINE_HEIGHT + (where ? WHERE_HEIGHT : 0) + detailsHeight + tableHeight;
}

/** Word typed to let an operation modify a destination (D9): the same for sync, backup and restore. */
export const CONFIRM_WORD = "confirmo";

/** The typed word matches `CONFIRM_WORD`, ignoring case and spaces at the ends. */
export const confirmationMatches = (typed: string) => typed.trim().toLowerCase() === CONFIRM_WORD;

/** One database of what is going to change: "reemplaza shop · completa · 3 colecciones", with its collections. */
export interface DangerItem {
  badge: string;
  /** Style of the badge (e.g. `replace`, `create`). */
  kind: string;
  name: string;
  detail: string;
  /** Every collection it touches, listed under the line. */
  collections: string[];
}

/** "Se va a MODIFICAR…": the second window of an operation that writes to a connection or a folder. */
export interface DangerConfirmRequest {
  /** Title of the window. */
  title: string;
  /** Banner before the destination (`MODIFY_HEADING` by default). */
  heading?: string;
  /** What gets written to, with its environment tag. */
  target: { name: string; tag?: string };
  /** Sentence under the banner (where the data comes from). */
  intro: string;
  items: DangerItem[];
  note?: string;
  /** Label of the red button. */
  confirmLabel: string;
  /** Why it can't go ahead now (e.g. another operation writes there); the button stays disabled. */
  blocked?: string;
}

/** What the danger window answers: go ahead, or back to the selection; null is "Cancelar". */
export type DangerAnswer = "confirm" | "back";

export const BACK_LABEL = "Volver";

export const MODIFY_HEADING = "Se va a MODIFICAR";

export const totalCollections = (items: DangerItem[]) => items.reduce((n, i) => n + i.collections.length, 0);

/** Up to this many collections every database opens listing them; beyond, they start folded to their line. */
const EXPANDED_COLLECTIONS = 40;

/** The databases of the window start open, listing their collections. */
export const dangerExpanded = (items: DangerItem[]) => items.length === 1 || totalCollections(items) <= EXPANDED_COLLECTIONS;

export const DANGER_WINDOW_WIDTH = 680;

// Rough metrics of the danger window, to fit its height to what it lists (`App.css`, `.danger-*`).
/** Title bar, banner, intro, totals, note, confirmation field and footer. */
const DANGER_CHROME_HEIGHT = 330;
const DANGER_DB_HEIGHT = 31;
const DANGER_COLLECTIONS_PADDING = 14;
const DANGER_COLLECTION_ROW = 18;
/** Columns of collections that fit in `DANGER_WINDOW_WIDTH`. */
const DANGER_COLLECTION_COLUMNS = 3;
/** The list scrolls beyond this (`.danger-dbs` max-height, plus its border and margin). */
const DANGER_LIST_MAX_HEIGHT = 348;
const DANGER_BLOCKED_HEIGHT = 50;
const DANGER_MIN_HEIGHT = 360;

/** Height of the danger window with its list unscrolled when it fits, so no empty space is left under the field. */
export function dangerWindowHeight({ items, blocked }: Pick<DangerConfirmRequest, "items" | "blocked">): number {
  const expanded = dangerExpanded(items);
  const list = items.reduce(
    (h, i) =>
      h +
      DANGER_DB_HEIGHT +
      (expanded ? DANGER_COLLECTIONS_PADDING + Math.ceil(i.collections.length / DANGER_COLLECTION_COLUMNS) * DANGER_COLLECTION_ROW : 0),
    8,
  );
  const height = DANGER_CHROME_HEIGHT + Math.min(list, DANGER_LIST_MAX_HEIGHT) + (blocked ? DANGER_BLOCKED_HEIGHT : 0);
  return Math.max(height, DANGER_MIN_HEIGHT);
}
