import { useId } from "react";
import { Modal, Spinner } from "../../../shared/ui/common";
import { isSameServer, type CollectionRef, type CopyProgress, type CopyRequest } from "../domain/copySpec";
import { CopyStatus } from "./CopyStatus";
import { Field } from "./Field";
import { useCopyForm } from "./useCopyForm";
import { useSubmit } from "./useSubmit";

/** An open connection the collection can be copied to, with the databases loaded in the tree. */
export interface CopyDestination {
  sid: string;
  label: string;
  databases: string[];
}

interface Props {
  source: CollectionRef;
  destinations: CopyDestination[];
  onCopy: (request: CopyRequest, onProgress: (p: CopyProgress) => void) => Promise<void>;
  onClose: () => void;
}

/** "Copiar colección a base de datos…": destination connection, database and name, and indexes. */
export function CopyCollectionDialog({ source, destinations, onCopy, onClose }: Props) {
  const { target, changeTarget, copyIndexes, setCopyIndexes, progress, setProgress, request } = useCopyForm(source);
  const databasesListId = useId();
  const { busy, error, submit } = useSubmit(() => {
    setProgress(null);
    return onCopy(request, setProgress);
  });
  const databases = destinations.find((d) => d.sid === target.sid)?.databases ?? [];
  // Closing is blocked while copying: the copy keeps running and its result would be lost.
  const close = busy ? () => {} : onClose;

  return (
    <Modal onClose={close} className="dialog">
      <h3>
        Copiar colección <span className="muted">· {source.db}.{source.coll}</span>
      </h3>
      <form onSubmit={submit}>
        <Field label="Conexión de destino">
          <select value={target.sid} onChange={(e) => changeTarget({ sid: e.target.value })} disabled={busy}>
            {destinations.map((d) => (
              <option key={d.sid} value={d.sid}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Base de datos de destino">
          <input
            list={databasesListId}
            value={target.db}
            onChange={(e) => changeTarget({ db: e.target.value })}
            placeholder="Existente o nueva"
            disabled={busy}
            autoFocus
            spellCheck={false}
          />
        </Field>
        <datalist id={databasesListId}>
          {databases.map((db) => (
            <option key={db} value={db} />
          ))}
        </datalist>
        <Field label="Nombre de la colección">
          <input
            value={target.coll}
            onChange={(e) => changeTarget({ coll: e.target.value })}
            disabled={busy}
            spellCheck={false}
          />
        </Field>
        <label className="check">
          <input type="checkbox" checked={copyIndexes} onChange={(e) => setCopyIndexes(e.target.checked)} disabled={busy} />
          Copiar también los índices
        </label>

        <p className="muted small">Si la colección de destino existe, se sustituye por la copia.</p>
        {busy && <CopyStatus progress={progress} sameServer={isSameServer(request)} />}
        {error && <p className="test error">{error}</p>}
        <div className="modal-footer">
          <span className="spacer" />
          <button type="button" onClick={close} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="primary" disabled={busy}>
            {busy && <Spinner />} Copiar
          </button>
        </div>
      </form>
    </Modal>
  );
}
