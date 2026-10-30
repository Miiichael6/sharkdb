import { describe, expect, it } from "vitest";
import type { CursorResult } from "../domain/outcome";
import type { ShellGateway } from "./ports";
import { createShellService } from "./shellService";

const SID = "s1";
const CURSOR_ID = 7;
const docs = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => ({ _id: from + i }));

/** Gateway over a fake 120-document cursor whose first 50 came with the script result. */
function fakeGateway() {
  const server = docs(50, 120);
  const calls: string[] = [];
  const gateway: ShellGateway = {
    async execute(sid, db, code) {
      calls.push(`execute ${sid} ${db} ${code}`);
      return { results: [{ kind: "print", text: "hola" }], error: null, elapsedMs: 3 };
    },
    async nextBatch(sid, cursorId, size) {
      calls.push(`next ${sid} ${cursorId} ${size}`);
      const documents = server.splice(0, size);
      return { documents, exhausted: server.length === 0 };
    },
    async closeCursor(sid, cursorId) {
      calls.push(`close ${sid} ${cursorId}`);
    },
    async cancel(sid) {
      calls.push(`cancel ${sid}`);
    },
  };
  return { gateway, calls };
}

const firstBatch: CursorResult = { kind: "cursor", ns: "test.x", cursorId: CURSOR_ID, documents: docs(0, 50), exhausted: false };

describe("shellService", () => {
  it("delegates execute and cancel to the gateway", async () => {
    const { gateway, calls } = fakeGateway();
    const shell = createShellService(gateway);
    const outcome = await shell.execute(SID, "test", "print('hola')");
    await shell.cancel(SID);
    expect(outcome.results).toEqual([{ kind: "print", text: "hola" }]);
    expect(calls).toEqual([`execute ${SID} test print('hola')`, `cancel ${SID}`]);
  });

  it("serves the first page from the script result without reading", async () => {
    const { gateway, calls } = fakeGateway();
    const page = await createShellService(gateway).pager(SID, firstBatch).page(0, 50);
    expect(page.documents).toEqual(docs(0, 50));
    expect(page.hasMore).toBe(true);
    expect(calls).toEqual([]);
  });

  it("reads only what the next page needs and caches visited pages", async () => {
    const { gateway, calls } = fakeGateway();
    const pager = createShellService(gateway).pager(SID, firstBatch);
    expect((await pager.page(50, 50)).documents).toEqual(docs(50, 100));
    expect((await pager.page(0, 50)).documents).toEqual(docs(0, 50));
    const last = await pager.page(100, 50);
    expect(last).toEqual({ documents: docs(100, 120), hasMore: false });
    expect(calls).toEqual([`next ${SID} ${CURSOR_ID} 50`, `next ${SID} ${CURSOR_ID} 50`]);
  });

  it("closes an open cursor once, and never an exhausted one", async () => {
    const { gateway, calls } = fakeGateway();
    const shell = createShellService(gateway);
    const pager = shell.pager(SID, firstBatch);
    await pager.close();
    await pager.close();
    await shell.pager(SID, { ...firstBatch, cursorId: null, exhausted: true }).close();
    expect(calls).toEqual([`close ${SID} ${CURSOR_ID}`]);
  });
});
