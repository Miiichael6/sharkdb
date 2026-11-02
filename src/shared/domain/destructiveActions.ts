// Manual actions that delete something, and how hard each one is to confirm (D12).
import { confirmationMatches } from "./confirmation";
import type { TargetServer } from "./documentTarget";
import { systemNamespaceWarning } from "./systemNamespaces";

/** `typed`: red window that needs `CONFIRM_WORD`; `simple`: red window, one click. */
export type ConfirmLevel = "typed" | "simple";

export type DestructiveAction =
  | "dropDatabase"
  | "dropCollection"
  | "replaceCollection"
  | "removeAllDocuments"
  | "dropUser"
  | "dropIndex"
  | "removeFunction"
  | "removeDocuments"
  | "deleteConnection"
  | "deleteSchedule";

/** What gets deleted: the connection, plus the database, collection and item inside it when they apply. */
export interface DestructiveTarget {
  server: TargetServer;
  db?: string;
  coll?: string;
  /** Index, user or function deleted inside the database or collection. */
  name?: string;
  /** Documents deleted by `removeDocuments`. */
  count?: number;
  /** The collection is a view. */
  view?: boolean;
}

/** "Se va a ELIMINAR …": the red window shown before a manual deletion. */
export interface DeleteConfirmRequest {
  title: string;
  level: ConfirmLevel;
  /** Where it is deleted, shown under the heading. */
  where: Pick<DestructiveTarget, "server" | "db" | "coll">;
  /** What is deleted, after the heading: "la base de datos “shop”". */
  subject: string;
  /** What is lost, on its own line. */
  loses: string;
  /** Extra line when it is MongoDB's own database or collection: the server lets it go, but depends on it. */
  warning?: string;
  /** Label of the red button. */
  confirmLabel: string;
}

export const DELETE_HEADING = "Se va a ELIMINAR";

export const IRREVERSIBLE = "No se puede deshacer.";

interface ActionText {
  level: ConfirmLevel;
  title: (t: DestructiveTarget) => string;
  subject: (t: DestructiveTarget) => string;
  loses: (t: DestructiveTarget) => string;
  confirmLabel: (t: DestructiveTarget) => string;
}

const collectionWord = (t: DestructiveTarget) => (t.view ? "vista" : "colección");

const documentsWord = (n = 0) => `${n} ${n === 1 ? "documento" : "documentos"}`;

// Levels as approved in D12; deleting a stored function isn't listed there and goes with the small ones.
const ACTIONS: Record<DestructiveAction, ActionText> = {
  dropDatabase: {
    level: "typed",
    title: () => "Eliminar base de datos",
    subject: (t) => `la base de datos “${t.db}”`,
    loses: () => "Todas sus colecciones, documentos, índices y usuarios.",
    confirmLabel: () => "Eliminar base de datos",
  },
  dropCollection: {
    level: "typed",
    title: (t) => `Eliminar ${collectionWord(t)}`,
    subject: (t) => `la ${collectionWord(t)} “${t.coll}”`,
    loses: (t) =>
      t.view ? "La definición de la vista; la colección de origen se conserva." : "Todos sus documentos e índices.",
    confirmLabel: (t) => `Eliminar ${collectionWord(t)}`,
  },
  replaceCollection: {
    level: "typed",
    title: () => "Sustituir colección",
    subject: (t) => `los documentos de “${t.coll}”, que se sustituyen por la copia`,
    loses: () => "Todos sus documentos, índices y opciones actuales: queda como el origen.",
    confirmLabel: () => "Sustituir colección",
  },
  removeAllDocuments: {
    level: "typed",
    title: () => "Eliminar todos los documentos",
    subject: (t) => `todos los documentos de “${t.coll}”`,
    loses: () => "Todos los documentos; la colección y sus índices se conservan.",
    confirmLabel: () => "Eliminar todos",
  },
  dropUser: {
    level: "typed",
    title: () => "Eliminar usuario",
    subject: (t) => `el usuario “${t.name}”`,
    loses: () => "Su acceso y sus roles en esta base de datos.",
    confirmLabel: () => "Eliminar usuario",
  },
  dropIndex: {
    level: "typed",
    title: () => "Eliminar índice",
    subject: (t) => `el índice “${t.name}”`,
    loses: () => "El índice; las consultas que lo usan irán más lentas hasta volver a crearlo.",
    confirmLabel: () => "Eliminar índice",
  },
  removeFunction: {
    level: "simple",
    title: () => "Eliminar función",
    subject: (t) => `la función “${t.name}”`,
    loses: () => "El código de la función guardada.",
    confirmLabel: () => "Eliminar función",
  },
  removeDocuments: {
    level: "simple",
    title: (t) => (t.count === 1 ? "Eliminar documento" : "Eliminar documentos"),
    subject: (t) => documentsWord(t.count),
    loses: (t) => (t.count === 1 ? "El documento seleccionado." : "Los documentos seleccionados."),
    confirmLabel: () => "Eliminar",
  },
  deleteConnection: {
    level: "simple",
    title: () => "Eliminar conexión",
    subject: (t) => `la conexión “${t.server.name}”`,
    loses: () => "Solo la conexión guardada en la app; el servidor y sus datos no se tocan.",
    confirmLabel: () => "Eliminar conexión",
  },
  deleteSchedule: {
    level: "simple",
    title: () => "Eliminar backup programado",
    subject: (t) => `el backup programado “${t.name}”`,
    loses: () => "Solo la programación: las copias ya guardadas en su carpeta no se tocan.",
    confirmLabel: () => "Eliminar programación",
  },
};

export const confirmLevel = (action: DestructiveAction) => ACTIONS[action].level;

// Users live in `admin` and functions in `system.js`: deleting them there is the usual thing, not a warning.
const NO_SYSTEM_WARNING: DestructiveAction[] = ["dropUser", "removeFunction"];

/** The red window's content for deleting `target` with `action`. */
export function destructiveRequest(action: DestructiveAction, target: DestructiveTarget): DeleteConfirmRequest {
  const text = ACTIONS[action];
  const { server, db, coll } = target;
  return {
    title: text.title(target),
    level: text.level,
    where: { server, db, coll },
    subject: text.subject(target),
    loses: text.loses(target),
    warning: NO_SYSTEM_WARNING.includes(action) ? undefined : systemNamespaceWarning(db, coll),
    confirmLabel: text.confirmLabel(target),
  };
}

/** The red button works: always at `simple`, at `typed` once the confirmation word is typed. */
export const canConfirmDeletion = (level: ConfirmLevel, typed: string) =>
  level === "simple" || confirmationMatches(typed);

// Fixed size of the red window: the connection line plus, at `typed`, the confirmation field and, for MongoDB's
// own namespaces, the warning.
export const DELETE_WINDOW_WIDTH = 600;
const DELETE_WINDOW_HEIGHT: Record<ConfirmLevel, number> = { typed: 330, simple: 250 };
const WARNING_HEIGHT = 50;

export const deleteWindowHeight = (request: Pick<DeleteConfirmRequest, "level" | "warning">) =>
  DELETE_WINDOW_HEIGHT[request.level] + (request.warning ? WARNING_HEIGHT : 0);
