// The MCP activity: every tool call the app's MCP server answered, newest first. Pure.

export type ActivityStatus = "running" | "ok" | "error";

/** One call as the backend tells it (`mcp://activity`): once when it starts and once when it ends. */
export interface McpActivity {
  id: number;
  tool: string;
  arguments: unknown;
  /** Milliseconds since the Unix epoch. */
  startedAt: number;
  status: ActivityStatus;
  durationMs: number | null;
  /** The reply (or the error), cut to a preview. */
  result: string | null;
}

export type ActivityFilter = { text: string; status: ActivityStatus | "all" };

export const ALL_ACTIVITY: ActivityFilter = { text: "", status: "all" };

/** Calls kept in memory; older ones are dropped. */
export const MAX_ACTIVITY = 200;

/** Adds a call, or updates it when it ends. */
export function recordActivity(list: McpActivity[], entry: McpActivity): McpActivity[] {
  if (list.some((a) => a.id === entry.id)) return list.map((a) => (a.id === entry.id ? entry : a));
  return [entry, ...list].slice(0, MAX_ACTIVITY);
}

/** The call's arguments in one line, for the list and the filter. */
export function argumentsSummary(entry: McpActivity): string {
  return JSON.stringify(entry.arguments ?? {});
}

export function filterActivity(list: McpActivity[], filter: ActivityFilter): McpActivity[] {
  const text = filter.text.trim().toLowerCase();
  return list.filter(
    (a) =>
      (filter.status === "all" || a.status === filter.status) &&
      (!text || a.tool.toLowerCase().includes(text) || argumentsSummary(a).toLowerCase().includes(text)),
  );
}
