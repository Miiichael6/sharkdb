import { confirmInWindow } from "../../../shared/ui/confirmInWindow";
import { useNotify } from "../../../shared/ui/useNotifications";
import { ExposedConnections } from "./ExposedConnections";
import { useClaude } from "./useClaude";

/** Which connections Claude may use, and the saved setup token. */
export function ClaudeSettings() {
  const { claude } = useClaude();
  const notify = useNotify();

  const forget = async () => {
    const confirmed = await confirmInWindow({
      title: "Olvidar el setup token",
      message: "Se borra el token del llavero y termina la conversación. Para volver a usar Claude tendrás que pegar otro.",
      confirmLabel: "Olvidar token",
    });
    if (confirmed) await claude.forgetToken().catch(notify.fail);
  };

  return (
    <div className="claude-settings">
      <h4>Conexiones que Claude puede usar</h4>
      <p className="claude-muted small">
        Con safe mode activo en una conexión, el servidor MCP rechaza sus escrituras (insert, update, delete, $out, $merge).
      </p>
      <ExposedConnections />
      <h4>Setup token</h4>
      <p className="claude-muted small">Guardado en el llavero del sistema.</p>
      <button type="button" onClick={() => void forget()}>
        Olvidar token
      </button>
    </div>
  );
}
