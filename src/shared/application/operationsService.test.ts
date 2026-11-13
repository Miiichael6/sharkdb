import { describe, expect, it } from "vitest";
import type { CollectionResult } from "../domain/jobs";
import type { OperationSpec } from "../domain/operations";
import type { JobListener, RunningJob } from "./jobRunner";
import { createOperationsService, RETRY_UNAVAILABLE, type StartedOperation } from "./operationsService";

const RESULTS: CollectionResult[] = [{ collection: "shop.orders", documents: 3, duplicates: 0, indexes: 1 }];
const SYNC: OperationSpec = {
  kind: "sync",
  title: "Sync",
  source: { name: "QA" },
  target: { name: "local" },
  writesTo: "local",
  databases: [{ db: "shop", collections: ["orders"] }],
};
const BACKUP: OperationSpec = { kind: "backup", title: "Backup", source: { name: "local" }, target: { name: "C:/bk" }, databases: [] };
const summarize = (results: CollectionResult[]) => `${results.length} colecciones`;

const IGNORED: JobListener = { progress: () => {}, collection: () => {} };

/** A job the test finishes by hand, recording whether it was cancelled and who listens to it. */
function fakeJob() {
  const state = { cancelled: false, listener: IGNORED, resolve: (_: CollectionResult[]) => {}, reject: (_: unknown) => {} };
  const launch = (listener: JobListener): RunningJob => {
    state.listener = listener;
    const result = new Promise<CollectionResult[]>((resolve, reject) => Object.assign(state, { resolve, reject }));
    return { result, cancel: () => void (state.cancelled = true) };
  };
  return { launch, state };
}

const newService = () => {
  let n = 0;
  return createOperationsService(() => 100, () => `op-${++n}`);
};

describe("operationsService", () => {
  it("tells what another window has running, as last checked, and forgets it when unreadable (error 60)", async () => {
    let busy: Promise<string | null> = Promise.resolve("un backup");
    const service = createOperationsService(undefined, undefined, { busy: () => busy });
    expect(service.busyElsewhere()).toBeUndefined();
    await service.checkElsewhere();
    expect(service.busyElsewhere()).toBe("un backup");
    busy = Promise.reject(new Error("sin acceso"));
    await service.checkElsewhere();
    expect(service.busyElsewhere()).toBeUndefined();
  });

  it("lists a started operation, its progress and its summary, and tells the listeners", async () => {
    const service = newService();
    const job = fakeJob();
    let changes = 0;
    service.subscribe(() => changes++);
    const started = service.start(SYNC, job.launch, summarize);
    job.state.listener.progress({ job: "j", collection: "shop.orders", index: 0, count: 1, done: 1, total: 2 });
    job.state.listener.collection({ job: "j", db: "shop", collection: "orders", state: "running", done: 1, total: 2 });
    expect(service.list()[0]).toMatchObject({ id: "op-1", status: "running", progress: { done: 1 } });
    expect(service.list()[0].collections).toEqual([{ db: "shop", collection: "orders", status: "running", done: 1, total: 2 }]);

    job.state.resolve(RESULTS);
    const ended = await started.settled;
    expect(ended).toMatchObject({ status: "done", summary: "1 colecciones", results: RESULTS });
    expect(changes).toBe(4);
  });

  it("ends as cancelled when it fails after a cancel", async () => {
    const service = newService();
    const job = fakeJob();
    const started = service.start(SYNC, job.launch, summarize);
    service.cancel(started.id);
    expect(job.state.cancelled).toBe(true);
    job.state.reject("Operación cancelada");
    expect((await started.settled).status).toBe("cancelled");
  });

  it("keeps the error of a failed operation", async () => {
    const service = newService();
    const job = fakeJob();
    const started = service.start(SYNC, job.launch, summarize);
    job.state.reject("sin red");
    expect(await started.settled).toMatchObject({ status: "failed", error: "sin red" });
  });

  it("rejects a second writer on the same destination until the first one ends", async () => {
    const service = newService();
    const first = fakeJob();
    const started = service.start(SYNC, first.launch, summarize);
    expect(() => service.start(SYNC, fakeJob().launch, summarize)).toThrow("Ya hay una operación escribiendo en local");
    expect(service.list()).toHaveLength(1);

    first.state.resolve(RESULTS);
    await started.settled;
    expect(() => service.start(SYNC, fakeJob().launch, summarize)).not.toThrow();
  });

  it("lets backups run side by side, even on a busy connection", () => {
    const service = newService();
    service.start(SYNC, fakeJob().launch, summarize);
    service.start(BACKUP, fakeJob().launch, summarize);
    service.start(BACKUP, fakeJob().launch, summarize);
    expect(service.list()).toHaveLength(3);
  });

  it("clears the ended operations", async () => {
    const service = newService();
    const ended = fakeJob();
    const started = service.start(SYNC, ended.launch, summarize);
    service.start(BACKUP, fakeJob().launch, summarize);
    ended.state.resolve(RESULTS);
    await started.settled;
    service.clearFinished();
    expect(service.list().map((o) => o.kind)).toEqual(["backup"]);
  });

  it("dismisses one ended operation", async () => {
    const service = newService();
    const ended = fakeJob();
    const started = service.start(SYNC, ended.launch, summarize);
    const running = service.start(BACKUP, fakeJob().launch, summarize);
    service.dismiss(running.id);
    ended.state.resolve(RESULTS);
    await started.settled;
    service.dismiss(started.id);
    expect(service.list().map((o) => o.id)).toEqual([running.id]);
  });

  describe("retry (R102)", () => {
    const REQUEST = { type: "sync", request: { sourceSid: "qa", targetSid: "local" } };

    /** A service with operation `op-1` failed, launched with `REQUEST`. */
    async function withFailed() {
      const service = newService();
      const job = fakeJob();
      const first = service.start({ ...SYNC, request: REQUEST }, job.launch, summarize);
      job.state.reject(new Error("sin red"));
      await first.settled;
      return service;
    }

    it("launches the same request as a new operation and marks the failed one as retried", async () => {
      const service = await withFailed();
      const relaunched: unknown[] = [];
      const again = fakeJob();
      const started = await service.retry("op-1", async (request) => {
        relaunched.push(request);
        return service.start({ ...SYNC, request }, again.launch, summarize);
      });
      expect(relaunched).toEqual([REQUEST]);
      expect(started?.id).toBe("op-2");
      expect(service.list().map((o) => [o.id, o.status, o.retriedBy])).toEqual([
        ["op-1", "failed", "op-2"],
        ["op-2", "running", undefined],
      ]);
      await expect(service.retry("op-1", async () => null)).rejects.toBe(RETRY_UNAVAILABLE);
    });

    it("leaves it retryable when the relaunch doesn't start or is refused", async () => {
      const service = await withFailed();
      expect(await service.retry("op-1", async () => null)).toBeNull();
      await expect(service.retry("op-1", () => Promise.reject("Safe mode activo"))).rejects.toBe("Safe mode activo");
      expect(service.list()[0].retriedBy).toBeUndefined();
    });

    it("refuses a running operation, an unknown one, and a second retry while the first is checking", async () => {
      const service = await withFailed();
      service.start(BACKUP, fakeJob().launch, summarize);
      await expect(service.retry("op-2", async () => null)).rejects.toBe(RETRY_UNAVAILABLE);
      await expect(service.retry("nope", async () => null)).rejects.toBe(RETRY_UNAVAILABLE);
      let finish = (_: StartedOperation | null) => {};
      const first = service.retry("op-1", () => new Promise((resolve) => (finish = resolve)));
      await expect(service.retry("op-1", async () => null)).rejects.toBe(RETRY_UNAVAILABLE);
      finish(null);
      await first;
    });
  });
});
