// The detail of one operation in its own sub-window (D24), kept live by the main window, which owns it.
import type { Operation } from "../../shared/domain/operations";
import { KIND_LABELS, operationRoute } from "../../shared/domain/operations";
import { openModalWindow } from "../../shared/ui/modalWindow";

export const OPERATION_DETAIL_VIEW = "operation-detail";

/** What the detail asks the main window to do: only it holds the job and the notifications. */
export type OperationDetailRequest = { kind: "cancel" } | { kind: "open-folder"; path: string };

/** What the main window needs to keep the detail of an operation live and do what it asks. */
export interface OperationDetailSource {
  /** The operation by its id, as it is now; undefined once it's no longer listed. */
  find: (id: string) => Operation | undefined;
  /** Calls `listener` after every change of the operations; returns what stops it. */
  subscribe: (listener: () => void) => () => void;
  handle: (id: string, request: OperationDetailRequest) => Promise<void>;
}

/** Tall enough for the route, the filter and several databases at once. */
const MIN_HEIGHT = 700;
const WINDOW = { width: 560, height: MIN_HEIGHT, minHeight: MIN_HEIGHT, maximizable: true };

/** "Detalle · Sync Prod → QA". */
const detailTitle = (op: Operation) => `Detalle · ${KIND_LABELS[op.kind]} ${operationRoute(op)}`;

/** Opens the detail of `op`; it follows the operation while it runs and closes with its own button. */
export function openOperationDetail(op: Operation, source: OperationDetailSource) {
  return openModalWindow<null>(OPERATION_DETAIL_VIEW, op, {
    ...WINDOW,
    title: detailTitle(op),
    onRequest: (body) => source.handle(op.id, body as OperationDetailRequest),
    updates: (send) => {
      let last = op;
      // The reducer gives a new object only to the operation that changed, so the others send nothing.
      return source.subscribe(() => {
        const now = source.find(op.id);
        if (!now || now === last) return;
        last = now;
        send(now);
      });
    },
  });
}
