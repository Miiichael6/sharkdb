// How the Claude tab writes durations, costs, times and JSON. Pure.

export const prettyJson = (value: unknown) => JSON.stringify(value ?? {}, null, 2);

export function formatDuration(ms: number | null): string {
  if (ms === null) return "…";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** Costs under a cent keep three decimals, so a short chat doesn't read as free. */
export function formatCost(usd: number): string {
  return `$${usd < 0.01 ? usd.toFixed(3) : usd.toFixed(2)}`;
}

export const formatTime = (epochMs: number) =>
  new Date(epochMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
