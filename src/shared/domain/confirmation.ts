// A yes/no question shown before an action that can't be undone.

export interface ConfirmRequest {
  /** Title of the window. */
  title: string;
  message: string;
  /** Label of the button that goes ahead. */
  confirmLabel: string;
  /** Label of the button that backs out (`DISMISS_LABEL` by default). */
  dismissLabel?: string;
}

export const DISMISS_LABEL = "Cancelar";

export const CONFIRM_WINDOW_WIDTH = 440;

// Rough text metrics of the window's message, to fit its height to it.
const CHARS_PER_LINE = 52;
const LINE_HEIGHT = 20;
const CHROME_HEIGHT = 120;
const MAX_LINES = 12;

/** Height of a confirmation window that shows `message` without scrolling (long ones are capped). */
export function confirmWindowHeight(message: string): number {
  const lines = message
    .split("\n")
    .reduce((n, line) => n + Math.max(1, Math.ceil(line.length / CHARS_PER_LINE)), 0);
  return CHROME_HEIGHT + Math.min(lines, MAX_LINES) * LINE_HEIGHT;
}

/** Word typed to let an operation modify a destination (D9): the same for sync, backup and restore. */
export const CONFIRM_WORD = "confirmo";

/** The typed word matches `CONFIRM_WORD`, ignoring case and spaces at the ends. */
export const confirmationMatches = (typed: string) => typed.trim().toLowerCase() === CONFIRM_WORD;

/** One line of what is going to change: "reemplaza shop · completa · 3 colecciones". */
export interface DangerItem {
  badge: string;
  /** Style of the badge (e.g. `replace`, `create`). */
  kind: string;
  name: string;
  detail: string;
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
