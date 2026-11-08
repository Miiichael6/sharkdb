import { useState, type FormEvent } from "react";
import { errorMessage } from "../../../shared/errors";
import { useClaude } from "./useClaude";

const INSTALL_COMMAND = "npm install -g @anthropic-ai/claude-code";
const SETUP_COMMAND = "claude setup-token";

/** First run of the Claude tab: how to get a setup token and where to paste it. */
export function TokenSetup() {
  const { claude } = useClaude();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await claude.saveToken(token);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="claude-setup" onSubmit={(e) => void submit(e)}>
      <h3>Conecta Claude con SharkDB</h3>
      <p className="claude-muted">
        Claude consulta las conexiones que tengas abiertas a través del servidor MCP de la app. Usa tu suscripción de Claude (Pro o Max)
        con un setup token.
      </p>
      <ol className="claude-steps">
        <li>
          Instala Claude Code si no lo tienes: <code>{INSTALL_COMMAND}</code>
        </li>
        <li>
          En una terminal ejecuta <code>{SETUP_COMMAND}</code> e inicia sesión con tu cuenta de Claude en el navegador.
        </li>
        <li>
          Copia el token que muestra al terminar (empieza por <code>sk-ant-</code>) y pégalo aquí.
        </li>
      </ol>
      <label className="claude-field">
        Setup token
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="sk-ant-oat01-…"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {error && <p className="claude-error">{error}</p>}
      <button type="submit" className="primary" disabled={!token.trim() || saving}>
        {saving ? "Guardando…" : "Guardar y empezar"}
      </button>
      <p className="claude-muted small">Se guarda en el llavero del sistema, nunca en un archivo. Puedes olvidarlo desde Ajustes.</p>
    </form>
  );
}
