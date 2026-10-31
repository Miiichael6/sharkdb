import { describe, expect, it } from "vitest";
import type { CollectionResult, JobProgress } from "../domain/jobs";
import type { OperationSpec } from "../domain/operations";
import type { RunningJob } from "./jobRunner";
import { createOperationsService } from "./operationsService";

const RESULTS: CollectionResult[] = [{ collection: "shop.orders", documents: 3, duplicates: 0, indexes: 1 }];
const SYNC: OperationSpec = { kind: "sync", title: "Sync", source: { name: "QA" }, target: { name: "local" }, writesTo: "local" };
const BACKUP: OperationSpec = { kind: "backup", title: "Backup", source: { name: "local" }, target: { name: "C:/bk" } };
const summarize = (results: CollectionResult[]) => `${results.length} colecciones`;

/** A job the test finishes by hand, recording whether it was cancelled and the progress callback. */
function fakeJob() {
  const state = { cancelled: false, report: (_: JobProgress) => {}, resolve: (_: CollectionResult[]) => {}, reject: (_: unknown) => {} };
  const launch = (onProgress: (p: JobProgress) => void): RunningJob => {
    state.report = onProgress;
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
  it("lists a started operation, its progress and its summary, and tells the listeners", async () => {
    const service = newService();
    const job = fakeJob();
    let changes = 0;
    service.subscribe(() => changes++);
    const started = service.start(SYNC, job.launch, summarize);
    job.state.report({ job: "j", collection: "shop.orders", index: 0, count: 1, done: 1, total: 2 });
    expect(service.list()[0]).toMatchObject({ id: "op-1", status: "running", progress: { done: 1 } });

    job.state.resolve(RESULTS);
    const ended = await started.settled;
    expect(ended).toMatchObject({ status: "done", summary: "1 colecciones", results: RESULTS });
    expect(changes).toBe(3);
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
});
