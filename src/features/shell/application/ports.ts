import type { CursorBatch, ScriptOutcome } from "../domain/outcome";

/** Runs scripts in the shell of an open server session (`sid`). */
export interface ShellGateway {
  execute(sid: string, db: string, code: string): Promise<ScriptOutcome>;
  nextBatch(sid: string, cursorId: number, size: number): Promise<CursorBatch>;
  closeCursor(sid: string, cursorId: number): Promise<void>;
  /** Stops the script (or batch read) running in the session, if any. */
  cancel(sid: string): Promise<void>;
}
