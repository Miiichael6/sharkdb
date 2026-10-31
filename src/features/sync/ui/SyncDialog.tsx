import { useEffect, useState, type FormEvent } from "react";
import { errorMessage } from "../../../shared/errors";
import { Field } from "../../../shared/ui/Field";
import type { Session } from "../../connections/domain/session";
import { confirmationMatches, originSelection, planLabel, syncPlan, syncRequest, validateSync, type SyncRequest } from "../domain/syncPlan";
import { DatabasePicker } from "./DatabasePicker";
import { SyncEndpoint } from "./SyncEndpoint";
import { SyncPlanSummary } from "./SyncPlanSummary";
import { useSourceCatalog } from "./useSourceCatalog";
import { useSyncForm, type SyncOrigin } from "./useSyncForm";

interface Props {
  sessions: Session[];
  origin: SyncOrigin;
  /** The confirmed sync, for the main window to run it in the background. */
  onDone: (request: SyncRequest) => void;
  onClose: () => void;
}

/**
 * "Sincronizar con otro entorno…", the content of its own window: replaces whole databases, or some of
 * their collections, in another connection (R30). It only chooses: the operations panel runs the sync.
 */
export function SyncDialog({ sessions, origin, onDone, onClose }: Props) {
  const [submitError, setSubmitError] = useState("");
  const form = useSyncForm(sessions, origin);
  const source = useSourceCatalog(form.sourceSid);
  const { setSelection } = form;

  // What the window was opened on is chosen once the origin's databases arrive.
  const fromOrigin = form.sourceSid === origin.sid;
  useEffect(() => {
    if (fromOrigin) setSelection(originSelection(source.catalog, origin.db, origin.collection));
  }, [fromOrigin, setSelection, source.catalog, origin.db, origin.collection]);

  const plan = syncPlan(source.catalog, form.selection, form.targetDatabases);
  const targetName = form.target?.name ?? "";
  const blocked = form.target?.blocked;
  const confirmed = confirmationMatches(form.confirmation, targetName);
  const canSync = !blocked && confirmed && plan.length > 0;
  const error = submitError || source.error;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (blocked) return setSubmitError(blocked);
    if (!canSync) return;
    try {
      onDone(validateSync(syncRequest(form.sourceSid, form.targetSid, plan)));
    } catch (err) {
      setSubmitError(errorMessage(err));
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <form className="sync-window" onSubmit={submit}>
      <div className="sync-body">
        <div className="sync-endpoints">
          <SyncEndpoint role="source" tag={form.source?.tag}>
            <Field label="Conexión">
              <select value={form.sourceSid} onChange={(e) => form.changeSource(e.target.value)}>
                {form.sources.map((s) => (
                  <option key={s.sid} value={s.sid}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          </SyncEndpoint>
          <div className="sync-arrow" aria-hidden>
            →
          </div>
          <SyncEndpoint role="target" tag={form.target?.tag}>
            <Field label="Conexión">
              <select value={form.targetSid} onChange={(e) => form.changeTarget(e.target.value)}>
                {!form.target && <option value="">Sin conexiones que se puedan modificar</option>}
                {form.targets.map((t) => (
                  <option key={t.sid} value={t.sid} disabled={!!t.blocked || t.sid === form.sourceSid}>
                    {t.blocked ? `${t.name} — ${t.blocked}` : t.name}
                  </option>
                ))}
              </select>
            </Field>
          </SyncEndpoint>
        </div>
        <p className="muted small sync-never-prod">
          Las conexiones protegidas o con etiqueta de producción nunca aparecen como destino.
        </p>

        <DatabasePicker
          key={form.sourceSid}
          catalog={source.catalog}
          loading={source.loading}
          selection={form.selection}
          onChange={form.setSelection}
          targetName={targetName}
          initiallyExpanded={form.sourceSid === origin.sid && origin.collection ? origin.db : undefined}
         
        />

        {blocked ? (
          <div className="restore-banner blocked">{blocked}</div>
        ) : (
          form.target && <SyncPlanSummary plan={plan} sourceName={form.source?.name ?? ""} target={form.target} />
        )}

        <label className="stack sync-confirm">
          <span className="muted">
            Para confirmar, escribe el nombre de la conexión de destino: <code>{targetName || "…"}</code>
          </span>
          <input
            className={confirmed ? "confirmed" : ""}
            value={form.confirmation}
            onChange={(e) => form.setConfirmation(e.target.value)}
            disabled={!!blocked || !form.target}
            spellCheck={false}
            autoComplete="off"
          />
        </label>

        {error && <p className="test error">{error}</p>}
      </div>

      <div className="modal-footer sync-footer">
        <span className="muted small">{plan.length > 0 && planLabel(plan)}</span>
        <span className="spacer" />
        <button type="button" onClick={onClose}>
          Cerrar
        </button>
        <button type="submit" className="danger" disabled={!canSync}>
          Sincronizar
        </button>
      </div>
    </form>
  );
}
