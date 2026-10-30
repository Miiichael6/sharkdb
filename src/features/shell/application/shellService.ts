import type { CursorResult } from "../domain/outcome";
import { createCursorPager } from "./cursorPager";
import type { ShellGateway } from "./ports";

export type ShellService = ReturnType<typeof createShellService>;

export function createShellService(gateway: ShellGateway) {
  return {
    execute: (sid: string, db: string, code: string) => gateway.execute(sid, db, code),
    cancel: (sid: string) => gateway.cancel(sid),
    /** Pages through a cursor result of a script run in session `sid`. */
    pager: (sid: string, cursor: CursorResult) => createCursorPager(gateway, sid, cursor),
  };
}
