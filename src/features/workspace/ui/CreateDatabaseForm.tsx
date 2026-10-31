import { useState, type FormEvent } from "react";
import { errorMessage } from "../../../shared/errors";
import { Field } from "../../../shared/ui/Field";

interface Props {
  /** Creates the database with its first collection; rejects with what went wrong. */
  onCreate: (db: string, coll: string) => Promise<void>;
  onCancel: () => void;
}

/** "Crear base de datos" inside the "Bases de datos" window: MongoDB needs a first collection. */
export function CreateDatabaseForm({ onCreate, onCancel }: Props) {
  const [db, setDb] = useState("");
  const [coll, setColl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onCreate(db.trim(), coll.trim());
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form className="db-create" onSubmit={submit}>
      <Field label="Nombre de la base de datos">
        <input autoFocus value={db} onChange={(e) => setDb(e.target.value)} />
      </Field>
      <Field label="Primera colección">
        <input value={coll} onChange={(e) => setColl(e.target.value)} />
      </Field>
      {error && <p className="danger-text">{error}</p>}
      <div className="db-create-actions">
        <button type="button" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button type="submit" className="primary" disabled={busy || !db.trim() || !coll.trim()}>
          Crear
        </button>
      </div>
    </form>
  );
}
