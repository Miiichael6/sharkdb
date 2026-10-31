import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { DISMISS_LABEL } from "../domain/confirmation";
import {
  DELETE_HEADING,
  IRREVERSIBLE,
  canConfirmDeletion,
  type DeleteConfirmRequest,
} from "../domain/destructiveActions";
import { ConfirmWordField } from "./ConfirmWordField";

interface Props {
  request: DeleteConfirmRequest;
  /** Connection, environment, database and collection (the opener knows how to draw them). */
  where: ReactNode;
  /** true to delete, null to cancel. */
  onDone: (confirmed: true | null) => void;
}

function AlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden className="icon">
      <path
        fillRule="evenodd"
        d="M7.13 1.5a1 1 0 0 1 1.74 0l6.5 11.5A1 1 0 0 1 14.5 14.5h-13a1 1 0 0 1-.87-1.5l6.5-11.5ZM8 5a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0v-3.5A.75.75 0 0 0 8 5Zm0 7.5a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z"
      />
    </svg>
  );
}

/**
 * Red window before a manual deletion (D12): "Se va a ELIMINAR" with where and what is lost. At `typed` the
 * button waits for the confirmation word; at `simple` the focus starts on "Cancelar", so Enter never deletes.
 * Escape cancels.
 */
export function DeleteConfirmWindow({ request, where, onDone }: Props) {
  const [typed, setTyped] = useState("");
  const canConfirm = canConfirmDeletion(request.level, typed);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (canConfirm) onDone(true);
  };

  return (
    <form className="danger-window delete-window" role="alertdialog" aria-label={request.title} onSubmit={submit}>
      <div className="danger-body">
        <div className="delete-plan">
          <div className="delete-heading">
            <AlertIcon />
            <span>{DELETE_HEADING}</span>
            <b>{request.subject}</b>
          </div>
          {where}
          <p className="delete-loses">
            Se pierde: {request.loses} {IRREVERSIBLE}
          </p>
        </div>
        {request.level === "typed" && <ConfirmWordField typed={typed} onChange={setTyped} />}
      </div>

      <div className="modal-footer danger-footer">
        <span className="spacer" />
        <button type="button" onClick={() => onDone(null)} autoFocus={request.level === "simple"}>
          {DISMISS_LABEL}
        </button>
        <button type="submit" className="danger" disabled={!canConfirm}>
          {request.confirmLabel}
        </button>
      </div>
    </form>
  );
}
