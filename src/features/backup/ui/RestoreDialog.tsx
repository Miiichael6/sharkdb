import { useState, type FormEvent } from "react";
import { useServices } from "../../../app/services";
import { errorMessage } from "../../../shared/errors";
import { formatBytes } from "../../../shared/format";
import type { CollectionResult } from "../../../shared/domain/jobs";
import { CollectionChecklist } from "../../../shared/ui/CollectionChecklist";
import { Modal, Spinner } from "../../../shared/ui/common";
import { confirmInWindow } from "../../../shared/ui/confirmInWindow";
import { JobProgressBar } from "../../../shared/ui/JobProgressBar";
import { useJob } from "../../../shared/ui/useJob";
import type { Session } from "../../connections/domain/session";
import { TagBadge } from "../../connections/ui/TagBadge";
import { Field } from "../../../shared/ui/Field";
import { folderName, restoreTargets, type BackupEntry } from "../domain/backupSpec";
import { FolderField } from "./FolderField";

export interface RestoreTarget {
  sid: string;
  db: string;
}

interface Props {
  sessions: Session[];
  /** Where the dialog was opened from: the default destination. */
  initial: RestoreTarget;
  onDone: (results: CollectionResult[], target: RestoreTarget) => void;
  onClose: () => void;
}

/** "Restaurar base de datos…": collections of a backup folder into a database of any open connection. */
export function RestoreDialog({ sessions, initial, onDone, onClose }: Props) {
  const { backup } = useServices();
  const targets = restoreTargets(sessions);
  const [sid, setSid] = useState(() =>
    targets.some((t) => t.sid === initial.sid && !t.blocked) ? initial.sid : (targets.find((t) => !t.blocked)?.sid ?? initial.sid),
  );
  const [db, setDb] = useState(initial.db);
  const [dir, setDir] = useState("");
  const [entries, setEntries] = useState<BackupEntry[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [dropBefore, setDropBefore] = useState(false);
  const job = useJob();
  const target = targets.find((t) => t.sid === sid);

  const readFolder = async (folder: string) => {
    if (!folder.trim()) return;
    job.setError("");
    try {
      const found = await backup.readFolder(folder);
      setEntries(found);
      setSelected(found.map((e) => e.collection));
      if (!db.trim()) setDb(folderName(folder));
    } catch (e) {
      setEntries([]);
      setSelected([]);
      job.setError(errorMessage(e));
    }
  };

  const browse = async () => {
    const folder = await backup.pickFolder("Carpeta del backup (la de la base de datos)");
    if (!folder) return;
    setDir(folder);
    void readFolder(folder);
  };

  const confirmDrop = () =>
    confirmInWindow({
      title: "Eliminar antes de restaurar",
      message: `Se eliminarán ${selected.length} colecciones de “${db.trim()}” en “${target?.name}” (${target?.tag}) antes de restaurarlas. ¿Continuar?`,
      confirmLabel: "Eliminar y restaurar",
    });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (target?.blocked) return job.setError(target.blocked);
    if (dropBefore && !(await confirmDrop())) return;
    const request = { sid, db, dir, collections: selected, dropBefore };
    const results = await job.run((onProgress) => backup.restore(request, onProgress));
    if (results) onDone(results, { sid, db: db.trim() });
  };
  const close = job.busy ? () => {} : onClose;

  return (
    <Modal onClose={close} className="dialog backup-dialog">
      <h3>Restaurar base de datos</h3>
      <form onSubmit={submit}>
        <FolderField
          label="Carpeta del backup"
          value={dir}
          onChange={setDir}
          onBlur={() => void readFolder(dir)}
          onBrowse={browse}
          disabled={job.busy}
        />
        {entries.length > 0 && (
          <CollectionChecklist
            items={entries.map((e) => ({ name: e.collection, detail: formatBytes(e.bytes) }))}
            selected={selected}
            onChange={setSelected}
            disabled={job.busy}
          />
        )}

        <div className="inline backup-target">
          <Field label="Conexión de destino">
            <select value={sid} onChange={(e) => setSid(e.target.value)} disabled={job.busy}>
              {targets.map((t) => (
                <option key={t.sid} value={t.sid} disabled={!!t.blocked}>
                  {t.blocked ? `${t.name} — ${t.blocked}` : t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Base de datos de destino">
            <input value={db} onChange={(e) => setDb(e.target.value)} disabled={job.busy} spellCheck={false} />
          </Field>
        </div>
        <label className="check">
          <input type="checkbox" checked={dropBefore} onChange={(e) => setDropBefore(e.target.checked)} disabled={job.busy} />
          Eliminar cada colección antes de restaurarla
        </label>
        <p className="muted small">Sin eliminar, los documentos cuyo _id ya existe se saltan.</p>

        {target && (
          <div className={`restore-banner ${target.blocked ? "blocked" : ""}`}>
            {target.blocked ? (
              target.blocked
            ) : (
              <>
                Se modificará <b>{db.trim() || "…"}</b> en <b>{target.name}</b>
              </>
            )}
            <span className="spacer" />
            <TagBadge tag={target.tag} />
          </div>
        )}

        {job.busy && <JobProgressBar progress={job.progress} />}
        {job.error && <p className="test error">{job.error}</p>}
        <div className="modal-footer">
          <span className="spacer" />
          {job.busy ? (
            <button type="button" onClick={job.cancel}>
              Cancelar restore
            </button>
          ) : (
            <button type="button" onClick={onClose}>
              Cerrar
            </button>
          )}
          <button type="submit" className={dropBefore ? "danger" : "primary"} disabled={job.busy || !!target?.blocked}>
            {job.busy && <Spinner />} Restaurar
          </button>
        </div>
      </form>
    </Modal>
  );
}
