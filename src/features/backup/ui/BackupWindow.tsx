import { useEffect, useState } from "react";
import { useServices } from "../../../app/services";
import { planLabel } from "../../../shared/domain/databasePlan";
import { catalogFavoritesFirst, initiallyExpanded } from "../../../shared/domain/selection";
import { errorMessage } from "../../../shared/errors";
import { DatabasePicker } from "../../../shared/ui/DatabasePicker";
import { Endpoint } from "../../../shared/ui/Endpoint";
import { EmptySelectionHint } from "../../../shared/ui/EmptySelectionHint";
import { SelectionWindow } from "../../../shared/ui/SelectionWindow";
import { useCatalog } from "../../../shared/ui/useCatalog";
import { useOriginSelection } from "../../../shared/ui/useOriginSelection";
import { favoritesOf } from "../../connections/domain/connection";
import { ConnectionField } from "../../connections/ui/ConnectionField";
import { TagBadge } from "../../connections/ui/TagBadge";
import { backupDatabases, backupPlan, currentSelection, validateBackup } from "../domain/backupSpec";
import type { BackupChoice, BackupWindowData } from "./backupViews";
import { FolderField } from "./FolderField";
import { useBackupForm } from "./useBackupForm";

interface Props {
  data: BackupWindowData;
  /** "Continuar": what was chosen, for the main window to ask for the confirmation. */
  onDone: (choice: BackupChoice) => void;
  onClose: () => void;
}

/** First window of the backup (R29): the connection to read, what to save and the folder it goes to. */
export function BackupWindow({ data, onDone, onClose }: Props) {
  const { origin, initial } = data;
  const { sync, backup } = useServices();
  const [submitError, setSubmitError] = useState("");
  const form = useBackupForm(data);
  const source = useCatalog(form.sourceStatus.connected ? form.sourceId : "", sync.databaseCatalog);
  useOriginSelection(!initial && form.sourceId === origin.sid, source.catalog, origin, form.setSelection);
  // Coming back to a saved choice: whole databases with the collections they have now (error 47).
  const { setSelection } = form;
  const resumed = initial && form.sourceId === initial.sid;
  useEffect(() => {
    if (resumed && source.catalog.length) setSelection(currentSelection(initial.databases, source.catalog));
  }, [resumed, initial, source.catalog, setSelection]);

  const plan = backupPlan(source.catalog, form.selection);
  const ready = !!form.dir.trim() && plan.length > 0;

  const browse = async () => {
    const dir = await backup.pickFolder("Carpeta donde guardar el backup");
    if (dir) form.setDir(dir);
  };
  const submit = () => {
    try {
      onDone({ request: validateBackup({ sid: form.sourceId, dir: form.dir, databases: backupDatabases(plan) }), plan });
    } catch (err) {
      setSubmitError(errorMessage(err));
    }
  };

  const fromStart = form.sourceId === (initial?.sid ?? origin.sid);
  return (
    <SelectionWindow
      source={
        <Endpoint role="source" badge={form.source && <TagBadge tag={form.source.tag} />}>
          <ConnectionField options={form.sources} value={form.sourceId} onChange={form.changeSource} status={form.sourceStatus} />
        </Endpoint>
      }
      target={
        <Endpoint role="target" hint="se guarda aquí">
          <FolderField label="Carpeta" value={form.dir} onChange={form.setDir} onBrowse={browse} />
        </Endpoint>
      }
      note="Cada base de datos va a su propia subcarpeta, como mongodump: se puede restaurar con mongorestore."
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
        title="Qué guardar"
        emptyText="La conexión no tiene bases de datos que guardar"
        initiallyExpanded={fromStart ? initiallyExpanded(initial?.databases, origin) : []}
      />
      <EmptySelectionHint plan={plan} />
    </SelectionWindow>
  );
}
