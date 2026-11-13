import { describe, expect, it } from "vitest";
import type { JobProgress } from "./jobs";
import {
  busyTargetMessage,
  canRetry,
  cancelConfirmation,
  closeWithRunningConfirmation,
  durationLabel,
  folderEndpoint,
  folderName,
  operationDetail,
  operationOutcome,
  operationsBadge,
  operationsReducer,
  retryConfirmation,
  runningOn,
  type Operation,
  type OperationEvent,
  type OperationSpec,
} from "./operations";

const SYNC: OperationSpec = {
  kind: "sync",
  title: "Sincronizar",
  source: { name: "QA", tag: "testing" },
  target: { name: "local", tag: "local" },
  writesTo: "local-sid",
  databases: [{ db: "shop", collections: ["orders", "users"] }],
};
const BACKUP: OperationSpec = { kind: "backup", title: "Backup", source: { name: "QA" }, target: { name: "C:/bk" }, databases: [] };
const RESULTS = [{ collection: "shop.orders", documents: 3, duplicates: 0, indexes: 1 }];
const progress = (index: number, done: number): JobProgress => ({ job: "j", collection: "shop.orders", index, count: 2, done, total: 10 });

const run = (events: OperationEvent[], from: Operation[] = []) => events.reduce(operationsReducer, from);
const started = (id: string, spec = SYNC, at = 1000): OperationEvent => ({ type: "started", id, spec, at });

describe("operationsReducer", () => {
  it("starts running and follows the progress", () => {
    const [op] = run([started("a"), { type: "progress", id: "a", progress: progress(1, 5) }]);
    expect(op).toMatchObject({ id: "a", kind: "sync", status: "running", startedAt: 1000, endedAt: null });
    expect(op.progress?.index).toBe(1);
    expect(operationsBadge([op])).toBe("75%");
  });

  it("ends as done, failed or cancelled, and ignores what comes after", () => {
    const ops = run([
      started("a"),
      started("b"),
      started("c"),
      { type: "finished", id: "a", results: RESULTS, summary: "Sincronizado local", at: 5000 },
      { type: "failed", id: "b", error: "sin red", at: 2000 },
      { type: "cancelled", id: "c", at: 3000 },
      { type: "progress", id: "a", progress: progress(0, 1) },
      { type: "failed", id: "a", error: "tarde", at: 9000 },
    ]);
    expect(ops.map((o) => o.status)).toEqual(["done", "failed", "cancelled"]);
    expect(ops[0]).toMatchObject({ results: RESULTS, summary: "Sincronizado local", endedAt: 5000, progress: null });
    expect(operationOutcome(ops[1])).toBe("Sync QA → local falló: sin red");
    expect(operationOutcome(ops[2])).toBe("Sync QA → local cancelado");
    expect(ops.map(operationDetail)).toEqual(["Sincronizado local", "sin red", ""]);
  });

  it("follows each collection from the plan and settles them when it ends (R95)", () => {
    const collection = (id: string, name: string, state: "copied" | "applied"): OperationEvent => ({
      type: "collection",
      id,
      update: { job: "j", db: "shop", collection: name, state, done: 10, total: 10 },
    });
    const [planned] = run([started("a")]);
    expect(planned.collections.map((c) => `${c.collection}:${c.status}`)).toEqual(["orders:pending", "users:pending"]);

    const [cancelled] = run([started("a"), collection("a", "orders", "copied"), { type: "cancelled", id: "a", at: 2000 }]);
    expect(cancelled.collections.map((c) => c.status)).toEqual(["discarded", "discarded"]);
    // An event of an operation that already ended changes nothing.
    const [late] = run([collection("a", "orders", "applied")], [cancelled]);
    expect(late.collections).toBe(cancelled.collections);

    const [done] = run([started("a"), { type: "finished", id: "a", results: RESULTS, summary: "", at: 3000 }]);
    expect(done.collections.map((c) => c.status)).toEqual(["applied", "applied"]);
  });

  it("clearing keeps only the running ones", () => {
    const ops = run([started("a"), started("b"), { type: "cancelled", id: "a", at: 2 }, { type: "cleared" }]);
    expect(ops.map((o) => o.id)).toEqual(["b"]);
  });

  it("dismissing removes one ended operation, never a running one", () => {
    const ended = [started("a"), started("b"), started("c"), { type: "failed", id: "a", error: "x", at: 2 } as const];
    expect(run([...ended, { type: "dismissed", id: "a" }]).map((o) => o.id)).toEqual(["b", "c"]);
    expect(run([...ended, { type: "dismissed", id: "b" }]).map((o) => o.id)).toEqual(["a", "b", "c"]);
  });
});

describe("one writer per destination", () => {
  it("finds the running operation that writes to a connection", () => {
    const ops = run([started("a"), started("b", BACKUP)]);
    expect(runningOn(ops, "local-sid")?.id).toBe("a");
    expect(runningOn(ops, "qa-sid")).toBeUndefined();
  });

  it("frees the destination once the operation ends", () => {
    const ops = run([started("a"), { type: "failed", id: "a", error: "x", at: 2 }]);
    expect(runningOn(ops, "local-sid")).toBeUndefined();
  });

  it("names the destination in the message", () => {
    expect(busyTargetMessage("local")).toBe("Ya hay una operación escribiendo en local");
  });
});

describe("texts", () => {
  it("badge counts the running ones and shows the oldest one's percentage", () => {
    const ops = run([started("a"), started("b"), { type: "progress", id: "a", progress: progress(0, 5) }]);
    expect(operationsBadge(ops)).toBe("2 · 25%");
    expect(operationsBadge([])).toBeUndefined();
  });

  it("asks before cancelling, saying what is kept, with buttons that can't be mistaken", () => {
    const [op] = run([started("a")]);
    expect(cancelConfirmation(op)).toMatchObject({
      message: "¿Cancelar la sincronización QA → local? El destino queda como estaba: no se reemplaza ninguna colección hasta que estén todas copiadas.",
      confirmLabel: "Detener la sincronización",
      dismissLabel: "Seguir",
    });
  });

  it("asks before closing with operations running", () => {
    expect(closeWithRunningConfirmation(1).message).toBe("Hay 1 operación en curso; se cancelará. ¿Cerrar SharkDB?");
    expect(closeWithRunningConfirmation(3)).toMatchObject({
      message: "Hay 3 operaciones en curso; se cancelarán. ¿Cerrar SharkDB?",
      confirmLabel: "Cancelar y cerrar",
      dismissLabel: "Seguir",
    });
  });

  it("formats durations", () => {
    expect(durationLabel(12_400)).toBe("12 s");
    expect(durationLabel(65_000)).toBe("1 min 05 s");
  });
});

describe("retry (R101, D27)", () => {
  const WITH_REQUEST: OperationSpec = { ...SYNC, request: { type: "sync" } };
  const ended = (end: OperationEvent) => run([started("a", WITH_REQUEST), end])[0];

  it("only a failed or cancelled operation that knows its request can be retried", () => {
    expect(canRetry(ended({ type: "failed", id: "a", error: "sin red", at: 2 }))).toBe(true);
    expect(canRetry(ended({ type: "cancelled", id: "a", at: 2 }))).toBe(true);
    expect(canRetry(ended({ type: "finished", id: "a", results: RESULTS, summary: "", at: 2 }))).toBe(false);
    expect(canRetry(run([started("a", WITH_REQUEST)])[0])).toBe(false);
    expect(canRetry(run([started("a"), { type: "failed", id: "a", error: "x", at: 2 }])[0])).toBe(false);
  });

  it("marks the retried one, which then can't be retried again; a running one is never marked", () => {
    const ops = run([
      started("a", WITH_REQUEST),
      started("b", WITH_REQUEST),
      { type: "failed", id: "a", error: "sin red", at: 2 },
      { type: "retried", id: "a", by: "c" },
      { type: "retried", id: "b", by: "d" },
    ]);
    expect(ops[0]).toMatchObject({ status: "failed", retriedBy: "c" });
    expect(canRetry(ops[0])).toBe(false);
    expect(ops[1].retriedBy).toBeUndefined();
  });

  it("asks with a short window, without the confirmation word", () => {
    const op = ended({ type: "failed", id: "a", error: "sin red", at: 2 });
    expect(retryConfirmation(op)).toEqual({
      title: "Reintentar operación",
      message: "¿Reintentar la sincronización QA → local? Se lanza de nuevo con el mismo origen, destino y colecciones.",
      confirmLabel: "Reintentar",
    });
  });
});

describe("folder endpoints", () => {
  it("are shown by the folder's name and keep the full path to open it", () => {
    expect(folderName("C:\\backups\\qa\\")).toBe("qa");
    expect(folderName("/home/me/dumps/2026")).toBe("2026");
    expect(folderEndpoint(" D:\\b\\local ")).toEqual({ name: "local", path: "D:\\b\\local" });
  });
});
