import { useMemo } from "react";
import { formatValue } from "../../domain/bsonFormat";
import { documentsOf } from "../../domain/resultView";
import { DocumentsView } from "./DocumentsView";
import type { ResultViewState } from "./useResultView";

interface Props {
  value: unknown;
  view: ResultViewState;
}

/** The script's final value: documents (`findOne`, write results, `toArray`) in the result views, anything else as shell text. */
export function ValueResult({ value, view }: Props) {
  const docs = useMemo(() => documentsOf(value), [value]);

  if (!docs) return <pre className="output-value">{formatValue(value, view.zone)}</pre>;
  return (
    <section className="doc-result" aria-label="Resultado">
      <header className="result-head">
        <span className="muted small">{docs.length === 1 ? "1 documento" : `${docs.length} documentos`}</span>
      </header>
      <DocumentsView docs={docs} firstNumber={1} mode={view.mode} zone={view.zone} />
    </section>
  );
}
