import { useState } from "react";
import { ALL_ACTIVITY, argumentsSummary, filterActivity, type ActivityFilter, type ActivityStatus } from "../domain/activity";
import { formatDuration, formatTime } from "../domain/format";
import { ActivityDetail } from "./ActivityDetail";
import { useClaude } from "./useClaude";

const STATUS_OPTIONS: { value: ActivityFilter["status"]; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "running", label: "En curso" },
  { value: "ok", label: "Correctas" },
  { value: "error", label: "Con error" },
];

/** Every call the app's MCP server answered, with a filter and the detail of the one selected. */
export function ActivityView() {
  const { state, claude } = useClaude();
  const [filter, setFilter] = useState<ActivityFilter>(ALL_ACTIVITY);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const shown = filterActivity(state.activity, filter);
  const selected = state.activity.find((a) => a.id === selectedId);

  return (
    <div className="claude-activity">
      <div className="claude-activity-filter">
        <input
          type="search"
          value={filter.text}
          placeholder="Filtrar por herramienta o argumentos"
          onChange={(e) => setFilter({ ...filter, text: e.target.value })}
        />
        <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value as ActivityStatus | "all" })}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="button" className="ghost small" onClick={claude.clearActivity} disabled={!state.activity.length}>
          Limpiar
        </button>
      </div>

      {shown.length ? (
        <ul className="claude-activity-list">
          {shown.map((a) => (
            <li key={a.id}>
              <button type="button" data-status={a.status} aria-pressed={a.id === selectedId} onClick={() => setSelectedId(a.id === selectedId ? null : a.id)}>
                <span className="claude-dot" aria-hidden />
                <span className="claude-tool-name">{a.tool}</span>
                <span className="claude-activity-args">{argumentsSummary(a)}</span>
                <span className="claude-muted small">
                  {formatTime(a.startedAt)} · {formatDuration(a.durationMs)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">{state.activity.length ? "Ninguna llamada coincide con el filtro." : "Aún no hay llamadas al servidor MCP."}</p>
      )}
      {selected && <ActivityDetail entry={selected} />}
    </div>
  );
}
