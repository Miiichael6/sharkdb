// A yes/no question shown before an action that can't be undone.

export interface ConfirmRequest {
  /** Title of the window. */
  title: string;
  message: string;
  /** Label of the button that goes ahead (the other one is always "Cancelar"). */
  confirmLabel: string;
}

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
