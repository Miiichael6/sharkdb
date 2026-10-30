import { useEffect, useRef } from "react";
import { logTime } from "../domain/log";
import { useLogEntries } from "./useLog";

/** Collapsible bottom panel with the application log (View → Logs in Robo 3T). */
export function LogPanel({ onClose }: { onClose: () => void }) {
  const { entries, clear } = useLogEntries();
  const listRef = useRef<HTMLOListElement>(null);

  // Follow new entries, like a terminal.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [entries]);

  return (
    <section className="log-panel" aria-label="Logs">
      <header className="log-head">
        <strong>Logs</strong>
        <span className="spacer" />
        <button className="ghost" onClick={clear} disabled={!entries.length}>
          Limpiar
        </button>
        <button className="ghost" onClick={onClose} title="Ocultar logs">
          ✕
        </button>
      </header>
      <ol className="log-list" ref={listRef} role="log">
        {entries.length === 0 && <li className="muted">Sin entradas todavía.</li>}
        {entries.map((e) => (
          <li key={e.id} className={`log-${e.level}`}>
            <span className="log-time">{logTime(e.at)}</span> {e.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
