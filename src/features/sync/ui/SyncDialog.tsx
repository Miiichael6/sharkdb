import { useEffect, type FormEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useServices } from "../../../app/services";
import type { CollectionResult } from "../../../shared/domain/jobs";
import { Spinner } from "../../../shared/ui/common";
import { Field } from "../../../shared/ui/Field";
import { JobProgressBar } from "../../../shared/ui/JobProgressBar";
import { useJob } from "../../../shared/ui/useJob";
import type { Session } from "../../connections/domain/session";
import { confirmationMatches, originSelection, planLabel, syncPlan, syncRequest } from "../domain/syncPlan";
import { DatabasePicker } from "./DatabasePicker";
import { SyncEndpoint } from "./SyncEndpoint";
import { SyncPlanSummary } from "./SyncPlanSummary";
import { useSourceCatalog } from "./useSourceCatalog";
import { useSyncForm, type SyncOrigin } from "./useSyncForm";

interface Props {
  sessions: Session[];
  origin: SyncOrigin;
  onDone: (results: CollectionResult[], target: { sid: string; databases: number }) => void;
  onClose: () => void;
}

/**
 * "Sincronizar con otro entorno…", the content of its own window: replaces whole databases, or some of
 * their collections, in another connection (R30). The window can't be closed while the sync runs.
 */
export function SyncDialog({ sessions, origin, onDone, onClose }: Props) {
  const { sync } = useServices();
  const job = useJob();
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
  const canSync = !job.busy && !blocked && confirmed && plan.length > 0;
  const error = job.error || source.error;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (blocked) return job.setError(blocked);
    if (!canSync) return;
    const request = syncRequest(form.sourceSid, form.targetSid, plan);
    const results = await job.run((onProgress) => sync.sync(request, onProgress));
    if (results) onDone(results, { sid: form.targetSid, databases: plan.length });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !job.busy && onClose();
    window.addEventListener("keydown", onKey);
    const stop = getCurrentWindow().onCloseRequested((e) => {
      if (job.busy) e.preventDefault();
    });
    return () => {
      window.removeEventListener("keydown", onKey);
      void stop.then((unlisten) => unlisten());
    };
  }, [job.busy, onClose]);

  return (
    <form className="sync-window" onSubmit={submit}>
      <div className="sync-body">
        <div className="sync-endpoints">
          <SyncEndpoint role="source" tag={form.source?.tag}>
            <Field label="Conexión">
              <select value={form.sourceSid} onChange={(e) => form.changeSource(e.target.value)} disabled={job.busy}>
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
              <select value={form.targetSid} onChange={(e) => form.changeTarget(e.target.value)} disabled={job.busy}>
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
          disabled={job.busy}
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
            disabled={job.busy || !!blocked || !form.target}
            spellCheck={false}
            autoComplete="off"
          />
        </label>

        {job.busy && <JobProgressBar progress={job.progress} />}
        {error && <p className="test error">{error}</p>}
      </div>

      <div className="modal-footer sync-footer">
        <span className="muted small">{plan.length > 0 && planLabel(plan)}</span>
        <span className="spacer" />
        {job.busy ? (
          <button type="button" onClick={job.cancel}>
            Cancelar sincronización
          </button>
        ) : (
          <button type="button" onClick={onClose}>
            Cerrar
          </button>
        )}
        <button type="submit" className="danger" disabled={!canSync}>
          {job.busy && <Spinner />} Sincronizar
        </button>
      </div>
    </form>
  );
}
