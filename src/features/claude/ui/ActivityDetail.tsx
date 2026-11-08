import type { McpActivity } from "../domain/activity";
import { formatDuration, formatTime, prettyJson } from "../domain/format";

/** The arguments and the reply (or the error) of one MCP call. */
export function ActivityDetail({ entry }: { entry: McpActivity }) {
  return (
    <section className="claude-activity-detail" data-status={entry.status} aria-label={`Detalle de ${entry.tool}`}>
      <header>
        <strong>{entry.tool}</strong>
        <span className="claude-muted small">
          {formatTime(entry.startedAt)} · {formatDuration(entry.durationMs)}
        </span>
      </header>
      <h5>Argumentos</h5>
      <pre>{prettyJson(entry.arguments)}</pre>
      <h5>{entry.status === "error" ? "Error" : "Resultado"}</h5>
      <pre>{entry.result ?? "En curso…"}</pre>
    </section>
  );
}
