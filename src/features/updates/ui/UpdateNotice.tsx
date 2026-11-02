import { useServices } from "../../../app/services";
import { isBusy, type UpdateStatus } from "../domain/update";
import { useUpdateStatus } from "./useUpdateStatus";

/** The line under the button: what the last check (or download) came to. */
function statusLine(status: UpdateStatus): { text: string; error?: boolean } | null {
  switch (status.kind) {
    case "checking":
      return { text: "Comprobando…" };
    case "upToDate":
      return { text: "Tienes la última versión" };
    case "downloading":
      return { text: `Descargando ${status.version}…${status.percent === null ? "" : ` ${status.percent} %`}` };
    case "error":
      return { text: status.message, error: true };
    default:
      return null;
  }
}

/** Under the app's name: the newer version, if there is one, and the button that looks for it. */
export function UpdateNotice() {
  const { updates } = useServices();
  const status = useUpdateStatus();
  const line = statusLine(status);
  return (
    <div className="update-notice">
      {status.kind === "available" && (
        <div className="update-available" title={status.notes || undefined}>
          <span>Hay una versión nueva: {status.version}</span>
          <button className="primary" onClick={() => void updates.install()}>
            Actualizar
          </button>
        </div>
      )}
      <button className="ghost" disabled={isBusy(status)} onClick={() => void updates.checkNow()}>
        Buscar actualizaciones
      </button>
      {line && (
        <span className={line.error ? "update-status error" : "update-status"} title={line.text} role="status">
          {line.text}
        </span>
      )}
    </div>
  );
}
