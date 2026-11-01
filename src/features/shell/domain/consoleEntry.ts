// The run's results as the Console view lists them: one entry per result, by its real type.
import { bsonValue } from "./bsonValue";
import type { ScriptError, ScriptOutcome, ScriptResult } from "./outcome";
import type { ResultEntry } from "./resultLayout";

/** Label of a write's result, as the shell names its class. */
export const WRITE_RESULT_LABEL = "WriteResult";

interface At {
  /** Line of the editor where the statement starts. */
  line: number;
  /** Index in `ScriptOutcome.results`: the cursor pagers' key. */
  index: number;
}

export type ConsoleEntry =
  /** `values`: the printed arguments when one is not text, shown by type instead of `text`. */
  | (At & { kind: "print"; text: string; values: unknown[] | null; json: boolean })
  | (At & { kind: "cursor" })
  | (At & { kind: "array"; value: unknown[] })
  | (At & { kind: "object"; value: unknown; label: string | null })
  | (At & { kind: "scalar"; value: unknown })
  | { kind: "error"; line: number | null; error: ScriptError };

/**
 * One entry per result, by what the backend says it is (`kind`) and the BSON type of its value, never by
 * how many documents it holds: a cursor or an array is an array even with a single document. The error,
 * if any, goes last.
 */
export function consoleEntries(outcome: ScriptOutcome): ConsoleEntry[] {
  const entries = outcome.results.map(consoleEntry);
  if (outcome.error) entries.push({ kind: "error", line: outcome.error.line, error: outcome.error });
  return entries;
}

function consoleEntry(result: ScriptResult, index: number): ConsoleEntry {
  const at = { line: result.line, index };
  switch (result.kind) {
    case "print":
      return { ...at, kind: "print", text: result.text, values: result.values ?? null, json: result.json ?? false };
    case "cursor":
      return { ...at, kind: "cursor" };
    case "write":
      return { ...at, kind: "object", value: result.value, label: WRITE_RESULT_LABEL };
    case "value":
      return valueEntry(result.value, at);
  }
}

function valueEntry(value: unknown, at: At): ConsoleEntry {
  const v = bsonValue(value);
  if (v.type === "array") return { ...at, kind: "array", value: v.items };
  if (v.type === "object") return { ...at, kind: "object", value, label: null };
  return { ...at, kind: "scalar", value };
}

/** The Console view of one result (a sub-tab): all its statement printed and returned, or the error. */
export function resultConsoleEntries(outcome: ScriptOutcome, entry: ResultEntry): ConsoleEntry[] {
  const entries = consoleEntries(outcome);
  if (entry.kind === "error") return entries.filter((e) => e.kind === "error");
  return entries.filter((e) => e.kind !== "error" && e.line === entry.line && outcome.results[e.index].source === entry.source);
}
