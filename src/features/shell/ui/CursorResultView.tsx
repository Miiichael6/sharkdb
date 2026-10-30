import { useEffect, useState } from "react";
import { errorMessage } from "../../../shared/errors";
import { Spinner } from "../../../shared/ui/common";
import type { CursorPager } from "../application/cursorPager";
import type { Page } from "../domain/outcome";

/** Documents per page, Robo 3T's default. */
export const PAGE_SIZE = 50;

/** One cursor result, paged through with ◀ ▶ (task 05 replaces this with the full results view). */
export function CursorResultView({ pager }: { pager: CursorPager }) {
  const [skip, setSkip] = useState(0);
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    setError("");
    pager.page(skip, PAGE_SIZE).then(
      (p) => current && setPage(p),
      (e) => current && setError(errorMessage(e)),
    );
    return () => {
      current = false;
    };
  }, [pager, skip]);

  const shown = page?.documents.length ?? 0;
  return (
    <div className="cursor-result">
      <div className="cursor-bar">
        <span className="mono">{pager.ns}</span>
        <span className="spacer" />
        <span className="muted small">{shown ? `${skip + 1}–${skip + shown}` : "0 documentos"}</span>
        <button className="ghost" aria-label="Página anterior" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}>
          ◀
        </button>
        <button className="ghost" aria-label="Página siguiente" disabled={!page?.hasMore} onClick={() => setSkip(skip + PAGE_SIZE)}>
          ▶
        </button>
      </div>
      {error && <div className="output-error">{error}</div>}
      {!page && !error && <Spinner />}
      {page?.documents.map((doc, i) => (
        <pre key={skip + i} className="json">
          {JSON.stringify(doc, null, 2)}
        </pre>
      ))}
    </div>
  );
}
