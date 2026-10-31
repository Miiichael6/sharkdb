import { useEffect, useState } from "react";
import { useServices } from "../../../app/services";
import { errorMessage } from "../../../shared/errors";
import type { DatabaseCatalog } from "../domain/syncPlan";

/** Databases of the source connection `sid` with their collections, reloaded when it changes. */
export function useSourceCatalog(sid: string) {
  const { sync } = useServices();
  const [catalog, setCatalog] = useState<DatabaseCatalog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCatalog([]);
    setError("");
    if (!sid) return;
    let current = true;
    setLoading(true);
    sync
      .databaseCatalog(sid)
      .then(
        (found) => current && setCatalog(found),
        (e) => current && setError(errorMessage(e)),
      )
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [sync, sid]);

  return { catalog, loading, error };
}
