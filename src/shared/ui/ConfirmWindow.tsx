import { useEffect, type ReactNode } from "react";
import { DISMISS_LABEL, type ConfirmDetail, type ConfirmRequest, type ConfirmTable } from "../domain/confirmation";

interface Props {
  request: ConfirmRequest;
  /** Shows `request.where` over the message. */
  where?: ReactNode;
  /** true to go ahead, null to cancel. */
  onDone: (confirmed: true | null) => void;
}

function ConfirmDetails({ details }: { details: ConfirmDetail[] }) {
  return (
    <dl className="confirm-details">
      {details.map(({ label, value }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd className="mono">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ConfirmComparison({ table }: { table: ConfirmTable }) {
  return (
    <table className="confirm-table">
      <thead>
        <tr>
          <th aria-hidden />
          {table.columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map(({ label, cells }) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            {cells.map((cell, i) => (
              <td key={table.columns[i]}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Content of a confirmation window: the window's title bar holds the title. Escape cancels. */
export function ConfirmWindow({ request, where, onDone }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  return (
    <div className="confirm-window" role="alertdialog" aria-label={request.title}>
      {where}
      <p>{request.message}</p>
      {request.details && <ConfirmDetails details={request.details} />}
      {request.table && <ConfirmComparison table={request.table} />}
      <div className="modal-footer">
        <span className="spacer" />
        <button onClick={() => onDone(null)} autoFocus={request.focusDismiss}>
          {request.dismissLabel ?? DISMISS_LABEL}
        </button>
        <button className={request.safe ? "primary" : "danger"} onClick={() => onDone(true)} autoFocus={!request.focusDismiss}>
          {request.confirmLabel}
        </button>
      </div>
    </div>
  );
}
