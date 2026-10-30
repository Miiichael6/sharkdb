import { Spinner } from "../../../../shared/ui/common";
import type { CursorPager } from "../../application/cursorPager";
import { DocumentsView } from "./DocumentsView";
import { PagingBar } from "./PagingBar";
import { useCursorPage } from "./useCursorPage";
import type { ResultViewState } from "./useResultView";

interface Props {
  pager: CursorPager;
  view: ResultViewState;
}

/** A cursor left as the script's value: its namespace, the page bar and the page's documents. */
export function CursorResult({ pager, view }: Props) {
  const { paging, setPaging, page, loading, error } = useCursorPage(pager);

  return (
    <section className="doc-result" aria-label={`Resultado de ${pager.ns}`}>
      <header className="result-head">
        <span className="mono">{pager.ns}</span>
        {loading && <Spinner />}
        <span className="spacer" />
        <PagingBar paging={paging} shown={page?.documents.length ?? 0} hasMore={!!page?.hasMore} disabled={loading} onChange={setPaging} />
      </header>
      {error && <div className="output-error">{error}</div>}
      {page && <DocumentsView docs={page.documents} firstNumber={paging.skip + 1} mode={view.mode} zone={view.zone} />}
    </section>
  );
}
