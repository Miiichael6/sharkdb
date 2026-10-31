import { useEffect } from "react";
import { originSelection, type DatabaseCatalog, type Selection } from "../domain/selection";

/**
 * Chooses what the window was opened on (a database or collection of the tree) once the catalog
 * arrives. `enabled` is false when coming back with a selection, or when the origin is elsewhere.
 */
export function useOriginSelection(
  enabled: boolean,
  catalog: DatabaseCatalog[],
  origin: { db?: string; collection?: string },
  setSelection: (selection: Selection) => void,
) {
  const { db, collection } = origin;
  useEffect(() => {
    if (enabled) setSelection(originSelection(catalog, db, collection));
  }, [enabled, catalog, db, collection, setSelection]);
}
