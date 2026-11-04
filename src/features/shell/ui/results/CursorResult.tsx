import { targetOfNamespace } from "../../../../shared/domain/documentTarget";
import { Spinner } from "../../../../shared/ui/common";
import type { CursorPager } from "../../application/cursorPager";
import { DocumentsView } from "./DocumentsView";
import { PagingBar } from "./PagingBar";
import { useCursorPage } from "./useCursorPage";
import { useDocumentMenu } from "./useDocumentMenu";
import { useFieldEdit } from "./useFieldEdit";
import type { ResultViewState } from "./useResultView";

interface Props {
  /** Session the script ran in. */
  sid: string;
  pager: CursorPager;
  view: ResultViewState;
  /** Replaces the namespace in the header when several results share the panel. */
  title?: string;
}

/** A cursor left as a statement's value: its namespace, the page bar and the page's documents. */
export function CursorResult({ sid, pager, view, title }: Props) {
  const { paging, setPaging, page, loading, error, reload } = useCursorPage(pager);
  const target = targetOfNamespace(sid, pager.ns);
  const documentMenu = useDocumentMenu(target, pager, reload, view.zone);
  const inlineEditing = useFieldEdit(target, pager, reload);

  return (
    <section className="doc-result" aria-label={`Resultado de ${pager.ns}`}>
      <header className="result-head">
        <span className="mono" title={pager.ns}>
          {title ?? pager.ns}
        </span>
        {loading && <Spinner />}
        <span className="spacer" />
        <PagingBar paging={paging} shown={page?.documents.length ?? 0} hasMore={!!page?.hasMore} disabled={loading} onChange={setPaging} />
      </header>
      {error && <div className="output-error">{error}</div>}
      {page && (
        <DocumentsView
          docs={page.documents}
          firstNumber={paging.skip + 1}
          mode={view.mode}
          zone={view.zone}
          documentMenu={documentMenu.entries}
          onDeleteDocuments={documentMenu.removeDocuments}
          inlineEditing={inlineEditing}
        />
      )}
    </section>
  );
}
