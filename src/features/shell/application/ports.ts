import type { Doc } from "../../explorer/domain/mongo";
import type { CursorBatch, ScriptOutcome } from "../domain/outcome";

/** A shell of its own per tab (`tab`) of an open server session (`sid`). */
export interface ShellRef {
  sid: string;
  tab: string;
}

/** Runs scripts in the shell of a tab. */
export interface ShellGateway {
  execute(shell: ShellRef, db: string, code: string): Promise<ScriptOutcome>;
  nextBatch(shell: ShellRef, cursorId: number, size: number): Promise<CursorBatch>;
  closeCursor(shell: ShellRef, cursorId: number): Promise<void>;
  /** Stops the script (or batch read) running in the shell, if any. */
  cancel(shell: ShellRef): Promise<void>;
  /** Frees the shell (its variables and cursors) when its tab is closed. */
  close(shell: ShellRef): Promise<void>;
}

/** Query history persisted per saved connection; entries are opaque here. */
export interface HistoryStore {
  load(connectionId: string): Promise<unknown>;
  save(connectionId: string, entries: unknown): Promise<void>;
}

/** Script files on disk, chosen by the user through native dialogs. */
export interface ScriptFiles {
  /** Path picked in an "open" dialog, or null if cancelled. */
  pickOpen(): Promise<string | null>;
  /** Path picked in a "save as" dialog, or null if cancelled. */
  pickSave(suggestedName: string): Promise<string | null>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
}

/** Read-only look at a database, to feed autocompletion. */
export interface SchemaSource {
  listCollections(sid: string, db: string): Promise<string[]>;
  sampleDocuments(sid: string, db: string, coll: string, limit: number): Promise<Doc[]>;
}
