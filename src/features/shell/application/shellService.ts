import type { CursorResult } from "../domain/outcome";
import { createCursorPager } from "./cursorPager";
import type { ShellGateway, ShellRef } from "./ports";

export type ShellService = ReturnType<typeof createShellService>;

export function createShellService(gateway: ShellGateway) {
  return {
    execute: (shell: ShellRef, db: string, code: string, scriptPath: string | null = null) =>
      gateway.execute(shell, db, code, scriptPath),
    cancel: (shell: ShellRef) => gateway.cancel(shell),
    close: (shell: ShellRef) => gateway.close(shell),
    /** Pages through a cursor result of a script run in `shell`. */
    pager: (shell: ShellRef, cursor: CursorResult) => createCursorPager(gateway, shell, cursor),
  };
}
