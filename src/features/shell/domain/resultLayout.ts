// How a run's results are shown: one result per statement, stacked or in sub-tabs like Robo 3T.
import type { ScriptError, ScriptOutcome, ScriptResult } from "./outcome";

/** Results shown one under another; from one more on, they go into sub-tabs. */
export const MAX_STACKED = 2;
/** Characters of the statement kept in a result's title. */
const MAX_TITLE_CHARS = 40;
const ELLIPSIS = "…";
export const TRUNCATED_TEXT = "Hay más resultados: solo se muestran los primeros.";

/** `db.getCollection('x')` at the start of a statement: the title keeps only `x`. */
const GET_COLLECTION = /^db\.getCollection\(\s*(['"`])(.*?)\1\s*\)/;
const DB_PREFIX = /^db\./;
const TRAILING_SEMICOLON = /;\s*$/;

export type ResultLayout = "single" | "stacked" | "tabs";

/** A value a statement returned, with its index in `ScriptOutcome.results` (the cursor pagers' key). */
export interface EntryValue {
  result: ScriptResult;
  index: number;
}

export interface StatementEntry {
  kind: "statement";
  line: number;
  source: string;
  prints: string[];
  value: EntryValue | null;
}

/** One statement's result (what it printed and the value it returned), or the error that stopped the run. */
export type ResultEntry = StatementEntry | { kind: "error"; error: ScriptError };

/** The run's results grouped by statement, in order; the error, if any, goes last. */
export function resultEntries(outcome: ScriptOutcome): ResultEntry[] {
  const entries: ResultEntry[] = [];
  let current: StatementEntry | null = null;
  outcome.results.forEach((result, index) => {
    if (!current || !belongsTo(current, result)) {
      current = { kind: "statement", line: result.line, source: result.source, prints: [], value: null };
      entries.push(current);
    }
    if (result.kind === "print") current.prints.push(result.text);
    else current.value = { result, index };
  });
  if (outcome.error) entries.push({ kind: "error", error: outcome.error });
  return entries;
}

/** A statement's value comes after its prints, so once it has one the next result is another statement. */
function belongsTo(entry: StatementEntry, result: ScriptResult): boolean {
  return !entry.value && entry.line === result.line && entry.source === result.source;
}

export function resultLayout(entries: readonly ResultEntry[]): ResultLayout {
  if (entries.length <= 1) return "single";
  return entries.length <= MAX_STACKED ? "stacked" : "tabs";
}

/** `L3 · Liquidadas_Claro.find`: the line and the statement without `db.getCollection(…)` or its arguments. */
export function resultTitle(entry: ResultEntry): string {
  if (entry.kind === "error") return entry.error.line ? `L${entry.error.line} · Error` : "Error";
  return `L${entry.line} · ${shortSource(entry.source)}`;
}

function shortSource(source: string): string {
  const target = source.trim().replace(GET_COLLECTION, "$2").replace(DB_PREFIX, "");
  const call = target.indexOf("(");
  const short = (call > 0 ? target.slice(0, call) : target).replace(TRAILING_SEMICOLON, "").trim();
  return short.length > MAX_TITLE_CHARS ? short.slice(0, MAX_TITLE_CHARS) + ELLIPSIS : short;
}
