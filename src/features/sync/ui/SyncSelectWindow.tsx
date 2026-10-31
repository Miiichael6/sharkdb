import { useEffect, useState, type FormEvent } from "react";
import { errorMessage } from "../../../shared/errors";
import { originSelection, planLabel, syncPlan, syncRequest, validateSync } from "../domain/syncPlan";
import { DatabasePicker } from "./DatabasePicker";
import { SyncConnectionField } from "./SyncConnectionField";
import { SyncEndpoint } from "./SyncEndpoint";
import { SyncPlanSummary } from "./SyncPlanSummary";
import type { SyncChoice, SyncWindowData } from "./syncViews";
import { useSourceCatalog } from "./useSourceCatalog";
import { useSyncForm } from "./useSyncForm";

interface Props {
  data: SyncWindowData;
  /** "Continuar": what was chosen, for the main window to ask for the confirmation. */
  onDone: (choice: SyncChoice) => void;
  onClose: () => void;
}

/**
 * First window of "Sincronizar con otro entorno…" (R39): source, destination and what to copy. It
 * neither confirms nor runs anything: "Continuar" hands the choice back to the main window.
 */
export function SyncSelectWindow({ data, onDone, onClose }: Props) {
  const { origin, initial } = data;
  const [submitError, setSubmitError] = useState("");
  const form = useSyncForm(data);
  const source = useSourceCatalog(form.sourceStatus.connected ? form.sourceId : "");
  const { setSelection } = form;

  // What the window was opened on is chosen once the origin's databases arrive (unless coming back).
  const fromOrigin = !initial && form.sourceId === origin.sid;
  useEffect(() => {
    if (fromOrigin) setSelection(originSelection(source.catalog, origin.db, origin.collection));
  }, [fromOrigin, setSelection, source.catalog, origin.db, origin.collection]);

  const plan = syncPlan(source.catalog, form.selection, form.targetDatabases);
  const ready = form.target && !form.target.blocked && form.targetStatus.connected && plan.length > 0;
  const error = submitError || source.error;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    try {
      onDone({ request: validateSync(syncRequest(form.sourceId, form.targetId, plan)), plan });
    } catch (err) {
      setSubmitError(errorMessage(err));
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const expanded = initial ? initial.databases.map((d) => d.db) : origin.collection && origin.db ? [origin.db] : [];
  return (
    <form className="sync-window" onSubmit={submit}>
      <div className="sync-body">
        <div className="sync-endpoints">
          <SyncEndpoint role="source" tag={form.source?.tag}>
            <SyncConnectionField
              options={form.sources}
              value={form.sourceId}
              onChange={form.changeSource}
              status={form.sourceStatus}
            />
          </SyncEndpoint>
          <div className="sync-arrow" aria-hidden>
            →
          </div>
          <SyncEndpoint role="target" tag={form.target?.tag}>
            <SyncConnectionField
              options={form.targets}
              value={form.targetId}
              onChange={form.changeTarget}
              status={form.targetStatus}
            />
          </SyncEndpoint>
        </div>
        <p className="muted small sync-never-prod">
          Las conexiones protegidas o con etiqueta de producción nunca aparecen como destino.
        </p>

        <DatabasePicker
          key={form.sourceId}
          catalog={source.catalog}
          loading={source.loading || form.sourceStatus.connecting}
          selection={form.selection}
          onChange={form.setSelection}
          targetName={form.target?.name ?? ""}
          initiallyExpanded={form.sourceId === (initial?.sourceSid ?? origin.sid) ? expanded : []}
        />

        {form.target && form.targetStatus.connected && <SyncPlanSummary plan={plan} />}

        {error && <p className="test error">{error}</p>}
      </div>

      <div className="modal-footer sync-footer">
        <span className="muted small">{plan.length > 0 && planLabel(plan)}</span>
        <span className="spacer" />
        <button type="button" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="primary" disabled={!ready}>
          Continuar
        </button>
      </div>
    </form>
  );
}
