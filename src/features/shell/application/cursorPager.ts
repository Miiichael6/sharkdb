import type { Doc } from "../../explorer/domain/mongo";
import { missingForPage, pageOf, type CursorResult, type Page } from "../domain/outcome";
import type { ShellGateway, ShellRef } from "./ports";

export type CursorPager = ReturnType<typeof createCursorPager>;

/**
 * skip/limit pages over a result cursor. The server cursor only moves forward, so documents
 * already read are kept: going back to a visited page doesn't hit the server.
 */
export function createCursorPager(gateway: ShellGateway, shell: ShellRef, cursor: CursorResult) {
  const buffer: Doc[] = [...cursor.documents];
  let exhausted = cursor.exhausted || cursor.cursorId === null;

  async function page(skip: number, limit: number): Promise<Page> {
    let missing = missingForPage(buffer.length, skip, limit);
    while (missing > 0 && !exhausted) {
      const batch = await gateway.nextBatch(shell, cursor.cursorId!, missing);
      buffer.push(...batch.documents);
      exhausted = batch.exhausted;
      missing = missingForPage(buffer.length, skip, limit);
    }
    return pageOf(buffer, skip, limit, exhausted);
  }

  /** Frees the server cursor; call it when the result is discarded. */
  async function close() {
    if (exhausted) return;
    exhausted = true;
    await gateway.closeCursor(shell, cursor.cursorId!);
  }

  return { ns: cursor.ns, page, close };
}
