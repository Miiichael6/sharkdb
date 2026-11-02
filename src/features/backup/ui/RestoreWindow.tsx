import { useState } from "react";
import { useServices } from "../../../app/services";
import { planLabel, planSelections } from "../../../shared/domain/databasePlan";
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
import { restorePlan, validateRestore } from "../domain/backupSpec";
import type { RestoreChoice, RestoreWindowData } from "./backupViews";
import { FolderField } from "./FolderField";
import { useRestoreForm } from "./useRestoreForm";

interface Props {
  data: RestoreWindowData;
  /** "Continuar": what was chosen, for the main window to ask for the confirmation. */
  onDone: (choice: RestoreChoice) => void;
  onClose: () => void;
}

/** First window of the restore (R29): the backup folder, what to restore from it and the connection it goes to. */
export function RestoreWindow({ data, onDone, onClose }: Props) {
  const { origin, initial } = data;
  const { backup } = useServices();
  const [submitError, setSubmitError] = useState("");
  const form = useRestoreForm(data);
  const source = useCatalog(form.folder, backup.readCatalog);
  // The database the window was opened on is chosen when the folder has it.
  useOriginSelection(!initial, source.catalog, origin, form.setSelection);

  const plan = restorePlan(source.catalog, form.selection, form.targetDatabases);
  const ready = !!form.target && !form.target.blocked && form.targetStatus.connected && plan.length > 0;

  const browse = async () => {
    const dir = await backup.pickFolder("Carpeta del backup");
    if (dir) form.readFolder(dir);
  };
  const submit = () => {
    try {
      onDone({ request: validateRestore({ dir: form.folder, targetSid: form.targetId, databases: planSelections(plan) }), plan });
    } catch (err) {
      setSubmitError(errorMessage(err));
    }
  };

  return (
    <SelectionWindow
      source={
        <Endpoint role="source">
          <FolderField
            label="Carpeta"
            value={form.dir}
            onChange={form.setDir}
            onBrowse={browse}
            onBlur={() => form.readFolder(form.dir)}
          />
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
        key={form.folder}
        catalog={catalogFavoritesFirst(source.catalog, favoritesOf(data.connections, form.targetId))}
        loading={source.loading}
        selection={form.selection}
        onChange={form.setSelection}
        title={form.target ? `Qué restaurar en ${form.target.name}` : "Qué restaurar"}
        emptyText={form.folder ? "La carpeta no tiene bases de datos de un backup" : "Elige la carpeta del backup"}
        initiallyExpanded={initiallyExpanded(initial?.databases, origin)}
      />
      {form.target && form.targetStatus.connected && <EmptySelectionHint plan={plan} />}
    </SelectionWindow>
  );
}
