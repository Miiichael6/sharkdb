import { useClaude } from "./useClaude";

/** The open connections, each with a check that lets Claude use it or not. */
export function ExposedConnections() {
  const { state, claude } = useClaude();
  if (!state.connections.length) return <p className="claude-muted">No hay conexiones abiertas. Abre una para que Claude pueda consultarla.</p>;
  return (
    <ul className="claude-connections">
      {state.connections.map((conn) => (
        <li key={conn.id}>
          <label>
            <input type="checkbox" checked={conn.exposed} onChange={(e) => claude.setExposed(conn.id, e.target.checked)} />
            <span className="claude-conn-name">{conn.name}</span>
            <span className={conn.safeMode ? "claude-tag safe" : "claude-tag"}>{conn.safeMode ? "Solo lectura" : "Lectura y escritura"}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
