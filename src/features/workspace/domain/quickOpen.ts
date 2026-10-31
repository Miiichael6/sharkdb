// Quick open palette: the candidates of each mode and the fuzzy ranking. Pure, no React.

export type QuickOpenMode = "connection" | "database" | "action";

export interface QuickItem {
  id: string;
  label: string;
  /** Secondary text, also searched (e.g. the connection of a database). */
  detail?: string;
  /** Shown on the right, e.g. a shortcut or "abierta". */
  hint?: string;
  /** Tooltip, e.g. why the item is disabled. */
  title?: string;
  disabled?: boolean;
}

export const QUICK_OPEN_PLACEHOLDERS: Record<QuickOpenMode, string> = {
  connection: "Abrir conexión…",
  database: "Abrir base de datos…",
  action: "Acción sobre la base de datos…",
};

// Bonuses of a matched character: right after the previous match, or at the start of a word.
const CONSECUTIVE_BONUS = 5;
const WORD_START_BONUS = 3;
/** Penalty per character before the first match, so earlier matches rank first. */
const LEADING_GAP_PENALTY = 0.1;
const WORD_SEPARATOR = /[\s._\-/:]/;

/** How well `query` matches `text` as a subsequence (case insensitive); null if it doesn't. */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let score = 0;
  let previous = -2;
  let first = -1;
  for (const ch of q) {
    const at = t.indexOf(ch, previous + 1);
    if (at < 0) return null;
    if (first < 0) first = at;
    score += 1;
    if (at === previous + 1) score += CONSECUTIVE_BONUS;
    if (at === 0 || WORD_SEPARATOR.test(t[at - 1])) score += WORD_START_BONUS;
    previous = at;
  }
  return score - first * LEADING_GAP_PENALTY;
}

/** Items matching `query`, best first; ties (and an empty query) keep the given order. */
export function fuzzyRank<T extends QuickItem>(query: string, items: T[]): T[] {
  const q = query.trim();
  if (!q) return items;
  return items
    .map((item) => ({ item, score: fuzzyScore(q, item.detail ? `${item.label} ${item.detail}` : item.label) }))
    .filter((r): r is { item: T; score: number } => r.score !== null)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
}

export interface ConnectionCandidate {
  id: string;
  name: string;
  open: boolean;
}

export const connectionItems = (connections: ConnectionCandidate[]): QuickItem[] =>
  connections.map((c) => ({ id: c.id, label: c.name, hint: c.open ? "abierta" : undefined }));

export interface DatabaseCandidate {
  /** Tree key of the database node. */
  key: string;
  db: string;
  connection: string;
}

export const databaseItems = (databases: DatabaseCandidate[]): QuickItem[] =>
  databases.map((d) => ({ id: d.key, label: d.db, detail: d.connection }));

export type QuickActionId =
  | "openShell"
  | "createCollection"
  | "dbStats"
  | "refresh"
  | "openMongosh"
  | "backup"
  | "restore"
  | "sync";

interface QuickAction {
  id: QuickActionId;
  label: string;
  /** Not built yet: listed but disabled, with the reason. */
  pending?: string;
}

export const QUICK_DB_ACTIONS: QuickAction[] = [
  { id: "openShell", label: "Nuevo shell" },
  { id: "createCollection", label: "Nueva colección…" },
  { id: "dbStats", label: "Estadísticas" },
  { id: "refresh", label: "Refrescar" },
  { id: "openMongosh", label: "Abrir en mongosh" },
  { id: "backup", label: "Backup…" },
  { id: "restore", label: "Restore…" },
  { id: "sync", label: "Sincronizar con otro entorno…", pending: "Disponible con la tarea de sincronización" },
];

/** The quick actions on database `db`; all disabled when there is no database to act on. */
export const actionItems = (db: string | undefined): QuickItem[] =>
  QUICK_DB_ACTIONS.map((a) => ({
    id: a.id,
    label: a.label,
    hint: a.pending ? "próximamente" : undefined,
    title: a.pending,
    disabled: !db || !!a.pending,
  }));
