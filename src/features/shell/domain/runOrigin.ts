// Running a selection: the backend numbers lines from the selection's start, the editor from its own.
import type { ScriptOutcome } from "./outcome";

/** Where the code that ran starts in the editor: line from 1, characters before it on that line. */
export interface RunOrigin {
  line: number;
  column: number;
}

/** The whole script ran: its lines already are the editor's. */
export const SCRIPT_START: RunOrigin = { line: 1, column: 0 };

/** The outcome with its results' and error's lines (and the error's column on the first line) as the editor's. */
export function atEditorLines(outcome: ScriptOutcome, origin: RunOrigin): ScriptOutcome {
  const lineShift = origin.line - 1;
  if (lineShift === 0 && origin.column === 0) return outcome;
  const { error } = outcome;
  return {
    ...outcome,
    results: outcome.results.map((r) => ({ ...r, line: r.line + lineShift })),
    error: error && {
      ...error,
      line: error.line === null ? null : error.line + lineShift,
      column: error.column === null || error.line !== 1 ? error.column : error.column + origin.column,
    },
  };
}
