import type { CursorResult } from "../domain/outcome";
import { createCursorPager } from "./cursorPager";
import type { RunOptions, ShellGateway, ShellRef } from "./ports";

export type ShellService = ReturnType<typeof createShellService>;

/** `runOptions` gives the preferences in force when each script starts. */
export function createShellService(gateway: ShellGateway, runOptions: () => RunOptions) {
  return {
    execute: (shell: ShellRef, db: string, code: string, scriptPath: string | null = null) =>
      gateway.execute(shell, db, code, scriptPath, runOptions()),
    cancel: (shell: ShellRef) => gateway.cancel(shell),
    close: (shell: ShellRef) => gateway.close(shell),
    /** Pages through a cursor result of a script run in `shell`. */
    pager: (shell: ShellRef, cursor: CursorResult) => createCursorPager(gateway, shell, cursor),
  };
}
