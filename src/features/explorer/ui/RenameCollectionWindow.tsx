import { useState } from "react";
import { useServices } from "../../../app/services";
import type { TargetWhere } from "../../../shared/domain/documentTarget";
import { Spinner } from "../../../shared/ui/common";
import { useEscapeDiscard } from "../../../shared/ui/useEscapeDiscard";
import { WhereBar } from "../../connections/ui/WhereBar";
import type { CollectionRef } from "../domain/copySpec";
import { useSubmit } from "./useSubmit";

export const RENAME_COLLECTION_VIEW = "rename-collection";

/** What the opener passes to the rename window. */
export interface RenameCollectionWindowData {
  collection: CollectionRef;
  /** Connection (name, environment, host:port), database and collection being renamed. */
  where: TargetWhere;
}

/** What the window hands back once the collection was renamed. */
export interface RenameCollectionWindowResult {
  name: string;
}

/**
 * "Renombrar colección…": the new name, under where the collection lives. Renames through the
 * services itself, so a failure (name taken, invalid…) keeps the window open with the error.
 */
export function RenameCollectionWindow({
  data,
  onDone,
}: {
  data: RenameCollectionWindowData;
  onDone: (result: RenameCollectionWindowResult | null) => void;
}) {
  const { explorer } = useServices();
  const { collection, where } = data;
  const [name, setName] = useState(collection.coll);
  const trimmed = name.trim();
  const changed = trimmed !== "" && trimmed !== collection.coll;
  const close = () => onDone(null);
  // A single name, easy to retype: Escape closes without asking.
  useEscapeDiscard(false, "El nuevo nombre", close);

  const { busy, error, submit } = useSubmit(async () => {
    await explorer.renameCollection(collection.sid, collection.db, collection.coll, trimmed);
    onDone({ name: trimmed });
  });

  return (
    <form className="document-window" onSubmit={(e) => (changed ? submit(e) : e.preventDefault())}>
      <WhereBar where={where} className="document-where" />
      <label className="stack">
        <span className="muted">Nuevo nombre</span>
        <input
          value={name}
          autoFocus
          spellCheck={false}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      {error && <p className="test error">{error}</p>}
      <div className="modal-footer">
        <span className="spacer" />
        <button type="button" onClick={close}>
          Cancelar
        </button>
        <button type="submit" className="primary" disabled={!changed || busy}>
          {busy && <Spinner />} Renombrar
        </button>
      </div>
    </form>
  );
}
