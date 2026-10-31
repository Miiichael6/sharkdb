import { useEffect, useState, type FormEvent } from "react";
import { useServices } from "../../../app/services";
import { errorMessage } from "../../../shared/errors";
import { Modal, Spinner } from "../../../shared/ui/common";
import { backupDir, type CollectionResult } from "../domain/backupSpec";
import { CollectionChecklist } from "./CollectionChecklist";
import { FolderField } from "./FolderField";
import { JobProgressBar } from "./JobProgressBar";
import { useBackupJob } from "./useBackupJob";

const SYSTEM_PREFIX = "system.";

interface Props {
  sid: string;
  db: string;
  /** Name of the source connection, for the title. */
  connection: string;
  onDone: (results: CollectionResult[]) => void;
  onClose: () => void;
}

/** "Backup de base de datos…": the chosen collections to `<folder>/<db>` in the mongodump format. */
export function BackupDialog({ sid, db, connection, onDone, onClose }: Props) {
  const { explorer, backup } = useServices();
  const [collections, setCollections] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [parent, setParent] = useState("");
  const job = useBackupJob();
  const { setError } = job;

  useEffect(() => {
    explorer.listCollections(sid, db).then(
      (list) => {
        // Views have no documents of their own: mongodump leaves them out too.
        const names = list.filter((c) => c.type === "collection").map((c) => c.name);
        setCollections(names);
        setSelected(names.filter((n) => !n.startsWith(SYSTEM_PREFIX)));
      },
      (e) => {
        setCollections([]);
        setError(errorMessage(e));
      },
    );
  }, [explorer, sid, db, setError]);

  const browse = async () => {
    const dir = await backup.pickFolder("Carpeta donde guardar el backup");
    if (dir) setParent(dir);
  };

  const dir = parent.trim() ? backupDir(parent, db) : "";
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const results = await job.run((onProgress) => backup.backup({ sid, db, collections: selected, dir }, onProgress));
    if (results) onDone(results);
  };
  const close = job.busy ? () => {} : onClose;

  return (
    <Modal onClose={close} className="dialog backup-dialog">
      <h3>
        Backup de {db} <span className="muted">· {connection}</span>
      </h3>
      <form onSubmit={submit}>
        <FolderField label="Carpeta de destino" value={parent} onChange={setParent} onBrowse={browse} disabled={job.busy} />
        {dir && <p className="muted small backup-path">Se guarda en {dir}</p>}

        {collections === null ? (
          <p className="muted small">
            <Spinner /> Cargando colecciones…
          </p>
        ) : (
          <CollectionChecklist items={collections.map((name) => ({ name }))} selected={selected} onChange={setSelected} disabled={job.busy} />
        )}

        {job.busy && <JobProgressBar progress={job.progress} />}
        {job.error && <p className="test error">{job.error}</p>}
        <div className="modal-footer">
          <span className="spacer" />
          {job.busy ? (
            <button type="button" onClick={job.cancel}>
              Cancelar backup
            </button>
          ) : (
            <button type="button" onClick={onClose}>
              Cerrar
            </button>
          )}
          <button type="submit" className="primary" disabled={job.busy || !collections}>
            {job.busy && <Spinner />} Hacer backup
          </button>
        </div>
      </form>
    </Modal>
  );
}
