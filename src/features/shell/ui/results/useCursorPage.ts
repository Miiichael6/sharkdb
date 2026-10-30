import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../../../../shared/errors";
import type { CursorPager } from "../../application/cursorPager";
import type { Page } from "../../domain/outcome";
import { firstPage, type Paging } from "../../domain/paging";

/** The page of a cursor result on screen; changing `paging` or calling `reload` reads it from the cursor. */
export function useCursorPage(pager: CursorPager) {
  const [paging, setPaging] = useState<Paging>(firstPage);
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reads, setReads] = useState(0);
  const reload = useCallback(() => setReads((n) => n + 1), []);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    pager
      .page(paging.skip, paging.limit)
      .then(
        (p) => current && setPage(p),
        (e) => current && setError(errorMessage(e)),
      )
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [pager, paging, reads]);

  return { paging, setPaging, page, loading, error, reload };
}
