// What running a shell script returns. BSON values travel as canonical Extended JSON.
import type { Uneditable } from "../../../shared/domain/documentTarget";
import type { Doc } from "../../explorer/domain/mongo";

export type ScriptErrorKind = "script" | "timeout" | "cancelled" | "outOfMemory" | "conversion" | "readOnly";

export interface ScriptError {
  kind: ScriptErrorKind;
  message: string;
  line: number | null;
  column: number | null;
}

/** A cursor left as a statement's value: its first batch and, if still open, its id. */
export interface CursorResult {
  kind: "cursor";
  ns: string;
  cursorId: number | null;
  documents: Doc[];
  exhausted: boolean;
  /** Whole documents of the collection (no projection, not from an aggregate): they can be edited or deleted. */
  editable: boolean;
  /** Why they aren't (null when they are); it also keeps them from being synced by `_id`. */
  uneditable: Uneditable | null;
}

export type ScriptOutput =
  /** `values`: the arguments of a `print` that got something other than text, for the Console view. */
  /** `json`: the text came from `printjson` and is shown as code. */
  | { kind: "print"; text: string; values?: unknown[]; json?: boolean }
  | { kind: "value"; value: unknown }
  | { kind: "write"; value: Doc }
  | CursorResult;

/** An output with the statement that produced it. */
export type ScriptResult = ScriptOutput & {
  /** Line of the script where the statement starts, from 1. */
  line: number;
  /** The statement's text, trimmed by the backend. */
  source: string;
  /** How long the statement took, including its first batch when it returned a cursor. */
  elapsedMs: number;
};

export interface ScriptOutcome {
  /** In run order: what each statement printed and the value it returned. */
  results: ScriptResult[];
  error: ScriptError | null;
  /** There were more results than the backend keeps; the rest were dropped. */
  truncated: boolean;
  elapsedMs: number;
  /** Part of `elapsedMs` waiting for the server; null when the script sent no query. */
  queryMs: number | null;
  /** Database `db` pointed to when the script ended (`use`, `db = db.getSiblingDB(…)`); null if it ended as something else. */
  db: string | null;
}

export interface CursorBatch {
  documents: Doc[];
  exhausted: boolean;
}

export interface Page {
  documents: Doc[];
  /** More documents exist after this page (already read or still on the server). */
  hasMore: boolean;
}

/** How many more documents must be read so `buffered` covers the page `skip`..`skip + limit`. */
export function missingForPage(buffered: number, skip: number, limit: number): number {
  return Math.max(0, skip + limit - buffered);
}

/** The page `skip`..`skip + limit` out of the documents read so far. */
export function pageOf(buffer: Doc[], skip: number, limit: number, exhausted: boolean): Page {
  const end = skip + limit;
  return { documents: buffer.slice(skip, end), hasMore: buffer.length > end || !exhausted };
}

/** How long a run took, in seconds like Robo 3T: `0.012 s`, `2.350 s`. */
export function elapsedText(ms: number): string {
  return `${(ms / 1000).toFixed(3)} s`;
}

/** Query time (what Robo 3T shows) and, apart, the time to load the results; the total without queries. */
export function timingText({ elapsedMs, queryMs }: Pick<ScriptOutcome, "elapsedMs" | "queryMs">): string {
  if (queryMs === null) return elapsedText(elapsedMs);
  return `${elapsedText(queryMs)} · carga ${elapsedText(Math.max(0, elapsedMs - queryMs))}`;
}

const ERROR_TITLE: Record<ScriptErrorKind, string> = {
  script: "Error",
  timeout: "Tiempo agotado",
  cancelled: "Detenido",
  outOfMemory: "Sin memoria",
  conversion: "Resultado no convertible",
  readOnly: "Solo lectura",
};

/** What a write stopped by safe mode says, instead of the backend's message. */
export const READ_ONLY_TEXT = "el script intenta escribir y esta conexión está en safe mode. Desactívalo con el candado de la barra para poder escribir.";

/** How a script error reads under the results: `Error (línea 3, columna 5): …`, `Solo lectura (línea 3): …`. */
export function scriptErrorText(e: ScriptError): string {
  if (e.kind === "readOnly") return `${ERROR_TITLE.readOnly}${e.line ? ` (línea ${e.line})` : ""}: ${READ_ONLY_TEXT}`;
  const at = e.line ? ` (línea ${e.line}${e.column ? `, columna ${e.column}` : ""})` : "";
  return `${ERROR_TITLE[e.kind]}${at}: ${e.message}`;
}
