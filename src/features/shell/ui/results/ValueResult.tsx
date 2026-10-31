import { useMemo } from "react";
import { formatValue } from "../../domain/bsonFormat";
import { documentsOf } from "../../domain/resultView";
import { DocumentsView } from "./DocumentsView";
import type { ResultViewState } from "./useResultView";

interface Props {
  value: unknown;
  view: ResultViewState;
}

/** The script's final value: documents (`findOne`, write results) and arrays (`toArray`) in the result views, anything else as shell text. */
export function ValueResult({ value, view }: Props) {
  const docs = useMemo(() => documentsOf(value, view.mode), [value, view.mode]);

  if (!docs) return <pre className="output-value">{formatValue(value, view.zone)}</pre>;
  // An array counts its elements, whether it shows as one root row or spread into the table.
  const count = Array.isArray(value)
    ? `${value.length} ${value.length === 1 ? "elemento" : "elementos"}`
    : "1 documento";
  return (
    <section className="doc-result" aria-label="Resultado">
      <header className="result-head">
        <span className="muted small">{count}</span>
      </header>
      <DocumentsView docs={docs} firstNumber={1} mode={view.mode} zone={view.zone} />
    </section>
  );
}
