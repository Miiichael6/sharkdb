import { describe, expect, it } from "vitest";
import type { CursorResult, ScriptResult } from "../domain/outcome";
import type { RunOptions, ShellGateway } from "./ports";
import { createShellService } from "./shellService";

const SHELL = { sid: "s1", tab: "t1" };
const PRINTED: ScriptResult = { kind: "print", text: "hola", line: 1, source: "print('hola')", elapsedMs: 1 };
const CURSOR_ID = 7;
const OPTIONS: RunOptions = { timeoutSeconds: 60, pageSize: 50 };
const docs = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => ({ _id: from + i }));

/** Gateway over a fake 120-document cursor whose first 50 came with the script result. */
function fakeGateway() {
  const server = docs(50, 120);
  const calls: string[] = [];
  const gateway: ShellGateway = {
    async execute(shell, db, code, scriptPath, options) {
      calls.push(`execute ${shell.tab} ${db} ${code} ${scriptPath} ${options.timeoutSeconds}/${options.pageSize}`);
      return { results: [PRINTED], error: null, truncated: false, elapsedMs: 3, queryMs: null };
    },
    async nextBatch(shell, cursorId, size) {
      calls.push(`next ${shell.tab} ${cursorId} ${size}`);
      const documents = server.splice(0, size);
      return { documents, exhausted: server.length === 0 };
    },
    async closeCursor(shell, cursorId) {
      calls.push(`close ${shell.tab} ${cursorId}`);
    },
    async cancel(shell) {
      calls.push(`cancel ${shell.tab}`);
    },
    async close(shell) {
      calls.push(`closeShell ${shell.tab}`);
    },
  };
  return { gateway, calls };
}

const firstBatch: CursorResult = { kind: "cursor", ns: "test.x", cursorId: CURSOR_ID, documents: docs(0, 50), exhausted: false, editable: true };

describe("shellService", () => {
  it("delegates execute, cancel and close to the tab's shell", async () => {
    const { gateway, calls } = fakeGateway();
    const shell = createShellService(gateway, () => OPTIONS);
    const outcome = await shell.execute(SHELL, "test", "print('hola')");
    await shell.cancel(SHELL);
    await shell.close(SHELL);
    expect(outcome.results).toEqual([PRINTED]);
    expect(calls).toEqual(["execute t1 test print('hola') null 60/50", "cancel t1", "closeShell t1"]);
  });

  it("runs each script with the options in force when it starts", async () => {
    const { gateway, calls } = fakeGateway();
    let options = OPTIONS;
    const shell = createShellService(gateway, () => options);
    await shell.execute(SHELL, "test", "1");
    options = { timeoutSeconds: 5, pageSize: 20 };
    await shell.execute(SHELL, "test", "2");
    expect(calls).toEqual(["execute t1 test 1 null 60/50", "execute t1 test 2 null 5/20"]);
  });

  it("serves the first page from the script result without reading", async () => {
    const { gateway, calls } = fakeGateway();
    const page = await createShellService(gateway, () => OPTIONS).pager(SHELL, firstBatch).page(0, 50);
    expect(page.documents).toEqual(docs(0, 50));
    expect(page.hasMore).toBe(true);
    expect(calls).toEqual([]);
  });

  it("reads only what the next page needs and caches visited pages", async () => {
    const { gateway, calls } = fakeGateway();
    const pager = createShellService(gateway, () => OPTIONS).pager(SHELL, firstBatch);
    expect((await pager.page(50, 50)).documents).toEqual(docs(50, 100));
    expect((await pager.page(0, 50)).documents).toEqual(docs(0, 50));
    const last = await pager.page(100, 50);
    expect(last).toEqual({ documents: docs(100, 120), hasMore: false });
    expect(calls).toEqual([`next ${SHELL.tab} ${CURSOR_ID} 50`, `next ${SHELL.tab} ${CURSOR_ID} 50`]);
  });

  it("shows a saved document in place and drops a deleted one", async () => {
    const pager = createShellService(fakeGateway().gateway, () => OPTIONS).pager(SHELL, firstBatch);
    const [first, second] = (await pager.page(0, 2)).documents;
    pager.replace(first, { _id: 0, edited: true });
    pager.replace(second, null);
    pager.replace({ _id: 1 }, { _id: 99 });
    expect((await pager.page(0, 2)).documents).toEqual([{ _id: 0, edited: true }, { _id: 2 }]);
  });

  it("closes an open cursor once, and never an exhausted one", async () => {
    const { gateway, calls } = fakeGateway();
    const shell = createShellService(gateway, () => OPTIONS);
    const pager = shell.pager(SHELL, firstBatch);
    await pager.close();
    await pager.close();
    await shell.pager(SHELL, { ...firstBatch, cursorId: null, exhausted: true }).close();
    expect(calls).toEqual([`close ${SHELL.tab} ${CURSOR_ID}`]);
  });
});
