// Background operations (sync, backup, restore) that the main window runs and the operations panel shows (R38).
import {
  applyCollectionEvent,
  plannedCollections,
  settleCollections,
  type CollectionProgressEntry,
  type CollectionUpdate,
} from "./collectionProgress";
import type { ConfirmRequest } from "./confirmation";
import { progressPercent, type CollectionResult, type JobProgress } from "./jobs";
import type { DatabaseSelection } from "./selection";

export type OperationKind = "sync" | "backup" | "restore";
export type OperationStatus = "running" | "done" | "failed" | "cancelled";

/** One end of an operation: a connection (with its environment tag) or a folder (with its full path). */
export interface OperationEndpoint {
  name: string;
  tag?: string;
  /** Where a connection points (`host:port`, SSH tunnel), never with user or password (R90). */
  address?: string;
  path?: string;
}

/** Last segment of a folder path, the name it's shown by: `C:\backups\qa\` is `qa`. */
export function folderName(dir: string): string {
  const parts = dir.trim().split(/[\\/]+/).filter(Boolean);
  return parts[parts.length - 1] ?? dir;
}

/** A backup folder as an end of an operation: shown by its name, opened by its path. */
export const folderEndpoint = (dir: string): OperationEndpoint => ({ name: folderName(dir), path: dir.trim() });

/** What is launched: the operation as the panel shows it. */
export interface OperationSpec {
  kind: OperationKind;
  title: string;
  source: OperationEndpoint;
  target: OperationEndpoint;
  /** Connection whose databases it modifies; a backup only reads, so it has none. */
  writesTo?: string;
  /** What was chosen: the collections it goes through, waiting from the start. */
  databases: DatabaseSelection[];
  /** What launched it, to launch it again as it was (R102); only the app knows its shape. */
  request?: unknown;
}

export interface Operation extends OperationSpec {
  id: string;
  status: OperationStatus;
  progress: JobProgress | null;
  /** State and progress of each chosen collection, in the order of the plan. */
  collections: CollectionProgressEntry[];
  results: CollectionResult[];
  /** Summary of a finished operation, for its row and its notification. */
  summary: string;
  error: string;
  /** Epoch milliseconds. */
  startedAt: number;
  endedAt: number | null;
  /** Id of the operation that retried this one: it stays in the history, retried once (R102). */
  retriedBy?: string;
}

export type OperationEvent =
  | { type: "started"; id: string; spec: OperationSpec; at: number }
  | { type: "progress"; id: string; progress: JobProgress }
  | { type: "collection"; id: string; update: CollectionUpdate }
  | { type: "finished"; id: string; results: CollectionResult[]; summary: string; at: number }
  | { type: "failed"; id: string; error: string; at: number }
  | { type: "cancelled"; id: string; at: number }
  | { type: "retried"; id: string; by: string }
  | { type: "cleared" }
  | { type: "dismissed"; id: string };

export const OPERATION_KINDS: OperationKind[] = ["sync", "backup", "restore"];

export const KIND_LABELS: Record<OperationKind, string> = { sync: "Sync", backup: "Backup", restore: "Restore" };

export const STATUS_LABELS: Record<OperationStatus, string> = {
  running: "En curso",
  done: "Terminada",
  failed: "Error",
  cancelled: "Cancelada",
};

export const OPERATION_BUSY_TARGET = "Ya hay una operación escribiendo en {destino}";
export const NO_OPERATIONS = "Sin operaciones";

const update = (ops: Operation[], id: string, change: (op: Operation) => Operation) =>
  ops.map((op) => (op.id === id ? change(op) : op));

/** Only a running operation changes: late events of an ended one are ignored. */
const whileRunning = (ops: Operation[], id: string, change: (op: Operation) => Operation) =>
  update(ops, id, (op) => (op.status === "running" ? change(op) : op));

/** `op` once it ended as `status`, with its collections settled accordingly (R95). */
const ended = (op: Operation, status: Exclude<OperationStatus, "running">, at: number): Operation => ({
  ...op,
  status,
  collections: settleCollections(op.collections, status, op.kind),
  endedAt: at,
});

export function operationsReducer(ops: Operation[], event: OperationEvent): Operation[] {
  switch (event.type) {
    case "started":
      return [
        ...ops,
        {
          ...event.spec,
          id: event.id,
          status: "running",
          progress: null,
          collections: plannedCollections(event.spec.databases),
          results: [],
          summary: "",
          error: "",
          startedAt: event.at,
          endedAt: null,
        },
      ];
    case "progress":
      return whileRunning(ops, event.id, (op) => ({ ...op, progress: event.progress }));
    case "collection":
      return whileRunning(ops, event.id, (op) => ({ ...op, collections: applyCollectionEvent(op.collections, event.update) }));
    case "finished":
      return whileRunning(ops, event.id, (op) => ({
        ...ended(op, "done", event.at),
        results: event.results,
        summary: event.summary,
      }));
    case "failed":
      return whileRunning(ops, event.id, (op) => ({ ...ended(op, "failed", event.at), error: event.error }));
    case "cancelled":
      return whileRunning(ops, event.id, (op) => ended(op, "cancelled", event.at));
    case "retried":
      return update(ops, event.id, (op) => (canRetry(op) ? { ...op, retriedBy: event.by } : op));
    case "cleared":
      return ops.filter((op) => op.status === "running");
    case "dismissed":
      return ops.filter((op) => op.id !== event.id || op.status === "running");
  }
}

export const isRunning = (op: Operation) => op.status === "running";

/** Whether `op` can be launched again: it failed or was cancelled (D27), and wasn't retried yet. */
export const canRetry = (op: Operation) =>
  (op.status === "failed" || op.status === "cancelled") && op.request !== undefined && !op.retriedBy;

export const RETRIED_LABEL = "Reintentada";
export const runningOperations = (ops: Operation[]) => ops.filter(isRunning);

/** The running operation that writes to `targetSid`, if any: only one may write to a connection at a time. */
export const runningOn = (ops: Operation[], targetSid: string) =>
  ops.find((op) => isRunning(op) && op.writesTo === targetSid);

export const busyTargetMessage = (target: string) => OPERATION_BUSY_TARGET.replace("{destino}", target);

export const operationsOfKind = (ops: Operation[], kind: OperationKind) => ops.filter((op) => op.kind === kind);

export const operationPercent = (op: Operation) => (op.status === "done" ? 100 : op.progress ? progressPercent(op.progress) : 0);

/**
 * Text of the toolbar badge: the running count and the percentage of the oldest one
 * ("45%" alone, "3 · 45%" with several), or nothing when none runs.
 */
export function operationsBadge(ops: Operation[]): string | undefined {
  const running = runningOperations(ops);
  if (!running.length) return undefined;
  const percent = `${operationPercent(running[0])}%`;
  return running.length === 1 ? percent : `${running.length} · ${percent}`;
}

/** "QA → local". */
export const operationRoute = (op: Pick<Operation, "source" | "target">) => `${op.source.name} → ${op.target.name}`;

/** What happens to the work already done when an operation is cancelled. */
const CANCEL_EFFECTS: Record<OperationKind, string> = {
  sync: "El destino queda como estaba: no se reemplaza ninguna colección hasta que estén todas copiadas.",
  backup: "Los archivos ya guardados se conservan; el de la colección a medias se descarta.",
  restore: "El destino queda como estaba: no se reemplaza ninguna colección hasta que estén todas restauradas.",
};

const OPERATION_NAMES: Record<OperationKind, string> = { sync: "la sincronización", backup: "el backup", restore: "el restore" };

/** Backs out of stopping or closing: "Cancelar" would read as "cancel the operation". */
export const KEEP_RUNNING = "Seguir";

/** "¿Cancelar la sincronización QA → local? …": Seguir, or "Detener la sincronización". */
export const cancelConfirmation = (op: Operation): ConfirmRequest => ({
  title: "Cancelar operación",
  message: `¿Cancelar ${OPERATION_NAMES[op.kind]} ${operationRoute(op)}? ${CANCEL_EFFECTS[op.kind]}`,
  confirmLabel: `Detener ${OPERATION_NAMES[op.kind]}`,
  dismissLabel: KEEP_RUNNING,
});

/**
 * "¿Reintentar la sincronización QA → local?": a short confirmation without the confirmation word,
 * typed already when it was first launched (D27); the destination stayed as it was (D23).
 */
export const retryConfirmation = (op: Operation): ConfirmRequest => ({
  title: "Reintentar operación",
  message: `¿Reintentar ${OPERATION_NAMES[op.kind]} ${operationRoute(op)}? Se lanza de nuevo con el mismo origen, destino y colecciones.`,
  confirmLabel: "Reintentar",
});

/** Asked when the app closes with `count` operations running. */
export const closeWithRunningConfirmation = (count: number): ConfirmRequest => ({
  title: "Cerrar SharkDB",
  message: `Hay ${count} ${count === 1 ? "operación en curso; se cancelará" : "operaciones en curso; se cancelarán"}. ¿Cerrar SharkDB?`,
  confirmLabel: "Cancelar y cerrar",
  dismissLabel: KEEP_RUNNING,
});

/** "1 min 05 s", "12 s": how long an ended operation took. */
export function durationLabel(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  if (!minutes) return `${seconds} s`;
  return `${minutes} min ${String(seconds % 60).padStart(2, "0")} s`;
}

/** What the panel row says under an ended operation; its route and status are already on the row. */
export function operationDetail(op: Operation): string {
  if (op.status === "done") return op.summary;
  if (op.status === "failed") return op.error;
  return "";
}

/** What the notification says when an operation ends. */
export function operationOutcome(op: Operation): string {
  if (op.status === "done") return op.summary;
  if (op.status === "failed") return `${KIND_LABELS[op.kind]} ${operationRoute(op)} falló: ${op.error}`;
  if (op.status === "cancelled") return `${KIND_LABELS[op.kind]} ${operationRoute(op)} cancelado`;
  return "";
}
