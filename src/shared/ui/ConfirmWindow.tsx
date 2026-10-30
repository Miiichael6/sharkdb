import { useEffect } from "react";
import type { ConfirmRequest } from "../domain/confirmation";

interface Props {
  request: ConfirmRequest;
  /** true to go ahead, null to cancel. */
  onDone: (confirmed: true | null) => void;
}

/** Content of a confirmation window: the window's title bar holds the title. Escape cancels. */
export function ConfirmWindow({ request, onDone }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  return (
    <div className="confirm-window" role="alertdialog" aria-label={request.title}>
      <p>{request.message}</p>
      <div className="modal-footer">
        <span className="spacer" />
        <button onClick={() => onDone(null)}>Cancelar</button>
        <button className="danger" onClick={() => onDone(true)} autoFocus>
          {request.confirmLabel}
        </button>
      </div>
    </div>
  );
}
