import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { BACK_LABEL, DISMISS_LABEL, MODIFY_HEADING, confirmationMatches, type DangerAnswer } from "../../../shared/domain/confirmation";
import { ConfirmWordField } from "../../../shared/ui/ConfirmWordField";
import { formatValue } from "../../shell/domain/bsonFormat";
import { documentsLabel, type DocumentSyncConfirmation, type DocumentSyncEnd } from "../domain/documentSync";

interface Props {
  request: DocumentSyncConfirmation;
  /** Environment pill of a connection's tag (the opener knows how to draw it). */
  badge: (tag?: string) => ReactNode;
  /** "confirm", "back", or null to cancel. */
  onDone: (answer: DangerAnswer | null) => void;
}

const ROLES = {
  source: { title: "Origen", hint: "solo se lee" },
  target: { title: "Destino", hint: "se modifica" },
};

function SyncEnd({ role, end, badge }: { role: keyof typeof ROLES; end: DocumentSyncEnd; badge: ReactNode }) {
  const namespace = `${end.db}.${end.collection}`;
  return (
    <section className={`selection-endpoint ${role}`}>
      <header>
        <b>{ROLES[role].title}</b>
        <span className="muted small">{ROLES[role].hint}</span>
        <span className="spacer" />
        {badge}
      </header>
      <div className="doc-sync-end">
        <b className="ellipsis" title={end.name}>
          {end.name}
        </b>
        {end.address && <span className="muted small ellipsis">{end.address}</span>}
        <span className="mono small ellipsis" title={namespace}>
          {namespace}
        </span>
      </div>
    </section>
  );
}

/**
 * Second window of the document sync (R99, D26): source → destination with connection, database and
 * collection, every document whole as read from the source (read only), and `confirmo` to go ahead.
 */
export function DocumentSyncConfirm({ request, badge, onDone }: Props) {
  const [typed, setTyped] = useState("");
  const canConfirm = confirmationMatches(typed, request.confirmWord) && !request.blocked && request.documents.length > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (canConfirm) onDone("confirm");
  };

  return (
    <form className="danger-window" role="alertdialog" aria-label={request.title} onSubmit={submit}>
      <div className="danger-body">
        <div className="selection-endpoints">
          <SyncEnd role="source" end={request.source} badge={badge(request.source.tag)} />
          <div className="selection-arrow" aria-hidden>
            →
          </div>
          <SyncEnd role="target" end={request.target} badge={badge(request.target.tag)} />
        </div>

        <div className="danger-plan doc-sync-plan">
          <div className="danger-plan-title">
            <span>{MODIFY_HEADING}</span>
            <b>{request.target.name}</b>
          </div>
          <p className="muted small">
            {documentsLabel(request.documents.length)}, leídos completos del origen. Cada uno reemplaza al de su mismo _id en
            el destino, o se inserta si no está.
          </p>
          {request.missing > 0 && <p className="small">{documentsLabel(request.missing)} ya no existen en el origen y no se sincronizan.</p>}
          <ol className="doc-sync-docs">
            {request.documents.map((doc, i) => (
              <li key={i}>
                <pre className="mono">{formatValue(doc, "utc")}</pre>
              </li>
            ))}
          </ol>
        </div>

        {request.blocked && <div className="restore-banner blocked">{request.blocked}</div>}

        <ConfirmWordField typed={typed} onChange={setTyped} disabled={!!request.blocked} word={request.confirmWord} />
      </div>

      <div className="modal-footer danger-footer">
        <button type="button" onClick={() => onDone("back")}>
          {BACK_LABEL}
        </button>
        <span className="spacer" />
        <button type="button" onClick={() => onDone(null)}>
          {DISMISS_LABEL}
        </button>
        <button type="submit" className="danger" disabled={!canConfirm}>
          {request.confirmLabel}
        </button>
      </div>
    </form>
  );
}
