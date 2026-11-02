import { describe, expect, it } from "vitest";
import type { JobProgress } from "./jobs";
import {
  busyTargetMessage,
  cancelConfirmation,
  closeWithRunningConfirmation,
  durationLabel,
  folderEndpoint,
  folderName,
  operationDetail,
  operationOutcome,
  operationsBadge,
  operationsReducer,
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
};
const BACKUP: OperationSpec = { kind: "backup", title: "Backup", source: { name: "QA" }, target: { name: "C:/bk" } };
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

  it("clearing keeps only the running ones", () => {
    const ops = run([started("a"), started("b"), { type: "cancelled", id: "a", at: 2 }, { type: "cleared" }]);
    expect(ops.map((o) => o.id)).toEqual(["b"]);
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

describe("folder endpoints", () => {
  it("are shown by the folder's name and keep the full path to open it", () => {
    expect(folderName("C:\\backups\\qa\\")).toBe("qa");
    expect(folderName("/home/me/dumps/2026")).toBe("2026");
    expect(folderEndpoint(" D:\\b\\local ")).toEqual({ name: "local", path: "D:\\b\\local" });
  });
});
