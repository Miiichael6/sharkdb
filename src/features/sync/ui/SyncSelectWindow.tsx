import { useState } from "react";
import { useServices } from "../../../app/services";
import { planLabel, replacePlan } from "../../../shared/domain/databasePlan";
import { catalogFavoritesFirst, initiallyExpanded } from "../../../shared/domain/selection";
import { errorMessage } from "../../../shared/errors";
import { DatabasePicker } from "../../../shared/ui/DatabasePicker";
import { Endpoint } from "../../../shared/ui/Endpoint";
import { PlanSummary } from "../../../shared/ui/PlanSummary";
import { SelectionWindow } from "../../../shared/ui/SelectionWindow";
import { useCatalog } from "../../../shared/ui/useCatalog";
import { useOriginSelection } from "../../../shared/ui/useOriginSelection";
import { favoritesOf } from "../../connections/domain/connection";
import { ConnectionField } from "../../connections/ui/ConnectionField";
import { TagBadge } from "../../connections/ui/TagBadge";
import { syncRequest, validateSync } from "../domain/syncPlan";
import type { SyncChoice, SyncWindowData } from "./syncViews";
import { useSyncForm } from "./useSyncForm";

interface Props {
  data: SyncWindowData;
  /** "Continuar": what was chosen, for the main window to ask for the confirmation. */
  onDone: (choice: SyncChoice) => void;
  onClose: () => void;
}

/** First window of "Sincronizar con otro entorno…" (R39): source, destination and what to copy. */
export function SyncSelectWindow({ data, onDone, onClose }: Props) {
  const { origin, initial } = data;
  const { sync } = useServices();
  const [submitError, setSubmitError] = useState("");
  const form = useSyncForm(data);
  const source = useCatalog(form.sourceStatus.connected ? form.sourceId : "", sync.databaseCatalog);
  useOriginSelection(!initial && form.sourceId === origin.sid, source.catalog, origin, form.setSelection);

  const plan = replacePlan(source.catalog, form.selection, form.targetDatabases);
  const ready = !!form.target && !form.target.blocked && form.targetStatus.connected && plan.length > 0;

  const submit = () => {
    try {
      onDone({ request: validateSync(syncRequest(form.sourceId, form.targetId, plan)), plan });
    } catch (err) {
      setSubmitError(errorMessage(err));
    }
  };

  const fromStart = form.sourceId === (initial?.sourceSid ?? origin.sid);
  return (
    <SelectionWindow
      source={
        <Endpoint role="source" badge={form.source && <TagBadge tag={form.source.tag} />}>
          <ConnectionField options={form.sources} value={form.sourceId} onChange={form.changeSource} status={form.sourceStatus} />
        </Endpoint>
      }
      target={
        <Endpoint role="target" badge={form.target && <TagBadge tag={form.target.tag} />}>
          <ConnectionField options={form.targets} value={form.targetId} onChange={form.changeTarget} status={form.targetStatus} />
        </Endpoint>
      }
      note="Las conexiones protegidas o con etiqueta de producción nunca aparecen como destino."
      error={submitError || source.error}
      footer={plan.length > 0 ? planLabel(plan) : ""}
      ready={ready}
      onContinue={submit}
      onClose={onClose}
    >
      <DatabasePicker
        key={form.sourceId}
        catalog={catalogFavoritesFirst(source.catalog, favoritesOf(data.connections, form.sourceId))}
        loading={source.loading || form.sourceStatus.connecting}
        selection={form.selection}
        onChange={form.setSelection}
        title={form.target ? `Qué copiar a ${form.target.name}` : "Qué copiar"}
        emptyText="La conexión de origen no tiene bases de datos que copiar"
        initiallyExpanded={fromStart ? initiallyExpanded(initial?.databases, origin) : []}
      />
      {form.target && form.targetStatus.connected && <PlanSummary plan={plan} />}
    </SelectionWindow>
  );
}
