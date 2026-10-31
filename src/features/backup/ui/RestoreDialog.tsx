import { useState, type FormEvent } from "react";
import { useServices } from "../../../app/services";
import { errorMessage } from "../../../shared/errors";
import { formatBytes } from "../../../shared/format";
import { CollectionChecklist } from "../../../shared/ui/CollectionChecklist";
import { Modal } from "../../../shared/ui/common";
import { confirmInWindow } from "../../../shared/ui/confirmInWindow";
import type { Session } from "../../connections/domain/session";
import { TagBadge } from "../../connections/ui/TagBadge";
import { Field } from "../../../shared/ui/Field";
import { folderName, restoreTargets, validateRestore, type BackupEntry, type RestoreRequest } from "../domain/backupSpec";
import { FolderField } from "./FolderField";

interface Props {
  sessions: Session[];
  /** Where the dialog was opened from: the default destination. */
  initial: { sid: string; db: string };
  /** The chosen restore, for the operations panel to run it. */
  onDone: (request: RestoreRequest) => void;
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
  const [error, setError] = useState("");
  const target = targets.find((t) => t.sid === sid);

  const readFolder = async (folder: string) => {
    if (!folder.trim()) return;
    setError("");
    try {
      const found = await backup.readFolder(folder);
      setEntries(found);
      setSelected(found.map((e) => e.collection));
      if (!db.trim()) setDb(folderName(folder));
    } catch (e) {
      setEntries([]);
      setSelected([]);
      setError(errorMessage(e));
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
    if (target?.blocked) return setError(target.blocked);
    let request: RestoreRequest;
    try {
      request = validateRestore({ sid, db, dir, collections: selected, dropBefore });
    } catch (err) {
      return setError(errorMessage(err));
    }
    if (dropBefore && !(await confirmDrop())) return;
    onDone(request);
  };

  return (
    <Modal onClose={onClose} className="dialog backup-dialog">
      <h3>Restaurar base de datos</h3>
      <form onSubmit={submit}>
        <FolderField
          label="Carpeta del backup"
          value={dir}
          onChange={setDir}
          onBlur={() => void readFolder(dir)}
          onBrowse={browse}
         
        />
        {entries.length > 0 && (
          <CollectionChecklist
            items={entries.map((e) => ({ name: e.collection, detail: formatBytes(e.bytes) }))}
            selected={selected}
            onChange={setSelected}
           
          />
        )}

        <div className="inline backup-target">
          <Field label="Conexión de destino">
            <select value={sid} onChange={(e) => setSid(e.target.value)}>
              {targets.map((t) => (
                <option key={t.sid} value={t.sid} disabled={!!t.blocked}>
                  {t.blocked ? `${t.name} — ${t.blocked}` : t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Base de datos de destino">
            <input value={db} onChange={(e) => setDb(e.target.value)} spellCheck={false} />
          </Field>
        </div>
        <label className="check">
          <input type="checkbox" checked={dropBefore} onChange={(e) => setDropBefore(e.target.checked)} />
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

        {error && <p className="test error">{error}</p>}
        <div className="modal-footer">
          <span className="spacer" />
          <button type="button" onClick={onClose}>
            Cerrar
          </button>
          <button type="submit" className={dropBefore ? "danger" : "primary"} disabled={!!target?.blocked}>
            Restaurar
          </button>
        </div>
      </form>
    </Modal>
  );
}
