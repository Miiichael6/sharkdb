// Query history of a connection: newest first, bounded, without consecutive repeats.

export interface HistoryEntry {
  code: string;
  db: string;
  /** Epoch milliseconds of the run. */
  at: number;
}

export const HISTORY_LIMIT = 100;

/** Adds a run at the front. Running the same code again just moves it up (no duplicate). */
export function pushHistory(entries: HistoryEntry[], entry: HistoryEntry, limit = HISTORY_LIMIT): HistoryEntry[] {
  const code = entry.code.trim();
  if (!code) return entries;
  const rest = entries[0]?.code === code ? entries.slice(1) : entries;
  return [{ ...entry, code }, ...rest].slice(0, limit);
}

/**
 * Next position when browsing history with Ctrl+↑ (`older`) / Ctrl+↓. Position -1 is the
 * editor's own text; 0 is the newest entry. Stays within bounds.
 */
export function stepHistory(length: number, position: number, direction: "older" | "newer"): number {
  const next = direction === "older" ? position + 1 : position - 1;
  return Math.min(Math.max(next, -1), length - 1);
}

/** Keeps only well-formed entries from a stored history file. */
export function parseHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is HistoryEntry =>
      typeof e === "object" && e !== null && typeof e.code === "string" && typeof e.db === "string" && typeof e.at === "number",
  );
}
