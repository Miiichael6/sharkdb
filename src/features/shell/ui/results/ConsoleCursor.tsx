import { Spinner } from "../../../../shared/ui/common";
import type { CursorPager } from "../../application/cursorPager";
import { grownPage } from "../../domain/paging";
import { ConsoleValue } from "./ConsoleValue";
import { useCursorPage } from "./useCursorPage";
import type { ResultViewState } from "./useResultView";

/** A cursor as one `Array`: the documents read so far, and «más…» to add the next page to it. */
export function ConsoleCursor({ pager, view }: { pager: CursorPager; view: ResultViewState }) {
  const { paging, setPaging, page, loading, error } = useCursorPage(pager);
  return (
    <>
      {page && <ConsoleValue value={page.documents} zone={view.zone} more={page.hasMore} />}
      {page?.hasMore && (
        <button className="link console-more" disabled={loading} onClick={() => setPaging(grownPage(paging))}>
          más…
        </button>
      )}
      {loading && <Spinner />}
      {error && <div className="output-error">{error}</div>}
    </>
  );
}
