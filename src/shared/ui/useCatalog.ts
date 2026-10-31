import { useEffect, useState } from "react";
import type { DatabaseCatalog } from "../domain/selection";
import { errorMessage } from "../errors";

/** Databases of `origin` (a connection or a backup folder) with their collections, reloaded when it changes; none for "". */
export function useCatalog(origin: string, load: (origin: string) => Promise<DatabaseCatalog[]>) {
  const [catalog, setCatalog] = useState<DatabaseCatalog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCatalog([]);
    setError("");
    if (!origin) return;
    let current = true;
    setLoading(true);
    load(origin)
      .then(
        (found) => current && setCatalog(found),
        (e) => current && setError(errorMessage(e)),
      )
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [load, origin]);

  return { catalog, loading, error };
}
