// Application log shown in the Logs panel: a bounded buffer of timestamped entries.

export type LogLevel = "info" | "error";

export interface LogEntry {
  id: number;
  level: LogLevel;
  /** Epoch milliseconds. */
  at: number;
  text: string;
}

export const LOG_LIMIT = 500;

/** Appends an entry, dropping the oldest ones past `limit`. */
export function appendLog(entries: LogEntry[], entry: Omit<LogEntry, "id">, limit = LOG_LIMIT): LogEntry[] {
  const id = (entries[entries.length - 1]?.id ?? 0) + 1;
  return [...entries, { ...entry, id }].slice(-limit);
}

/** `HH:MM:SS` in local time, as Robo 3T prints its log lines. */
export function logTime(at: number): string {
  const d = new Date(at);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
}
