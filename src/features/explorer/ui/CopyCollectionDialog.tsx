import { useId } from "react";
import { Modal, Spinner } from "../../../shared/ui/common";
import type { CollectionRef, CopyRequest } from "../domain/copySpec";
import { Field } from "../../../shared/ui/Field";
import { useCopyForm } from "./useCopyForm";
import { useSubmit } from "./useSubmit";

interface Props {
  source: CollectionRef;
  /** Databases of the source's server loaded in the tree, offered as destinations. */
  databases: string[];
  onCopy: (request: CopyRequest) => Promise<void>;
  onClose: () => void;
}

/** "Copiar colección a base de datos…": destination database and name on the same server, and indexes. */
export function CopyCollectionDialog({ source, databases, onCopy, onClose }: Props) {
  const { target, changeTarget, copyIndexes, setCopyIndexes, request } = useCopyForm(source);
  const databasesListId = useId();
  const { busy, error, submit } = useSubmit(() => onCopy(request));
  // Closing is blocked while copying: the copy keeps running and its result would be lost.
  const close = busy ? () => {} : onClose;

  return (
    <Modal onClose={close} className="dialog">
      <h3>
        Copiar colección <span className="muted">· {source.db}.{source.coll}</span>
      </h3>
      <form onSubmit={submit}>
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
        {busy && <p className="muted small">Copiando en el servidor…</p>}
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
