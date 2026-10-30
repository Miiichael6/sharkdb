// What running a shell script returns. BSON values travel as canonical Extended JSON.
import type { Doc } from "../../explorer/domain/mongo";

export type ScriptErrorKind = "script" | "timeout" | "cancelled" | "outOfMemory" | "conversion";

export interface ScriptError {
  kind: ScriptErrorKind;
  message: string;
  line: number | null;
  column: number | null;
}

/** A cursor left as the script's final value: its first batch and, if still open, its id. */
export interface CursorResult {
  kind: "cursor";
  ns: string;
  cursorId: number | null;
  documents: Doc[];
  exhausted: boolean;
}

export type ScriptResult =
  | { kind: "print"; text: string }
  | { kind: "value"; value: unknown }
  | { kind: "write"; value: Doc }
  | CursorResult;

export interface ScriptOutcome {
  /** In order: printed lines and, last, the script's value. */
  results: ScriptResult[];
  error: ScriptError | null;
  elapsedMs: number;
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

const ERROR_TITLE: Record<ScriptErrorKind, string> = {
  script: "Error",
  timeout: "Tiempo agotado",
  cancelled: "Detenido",
  outOfMemory: "Sin memoria",
  conversion: "Resultado no convertible",
};

/** How a script error reads under the results: `Error (línea 3, columna 5): …`. */
export function scriptErrorText(e: ScriptError): string {
  const at = e.line ? ` (línea ${e.line}${e.column ? `, columna ${e.column}` : ""})` : "";
  return `${ERROR_TITLE[e.kind]}${at}: ${e.message}`;
}
