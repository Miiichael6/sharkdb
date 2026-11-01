import { useMemo } from "react";
import { formatValue } from "../../domain/bsonFormat";
import { documentsOf } from "../../domain/resultView";
import { DocumentsView } from "./DocumentsView";
import type { ResultViewState } from "./useResultView";

interface Props {
  value: unknown;
  view: ResultViewState;
  /** Header title when several results share the panel. */
  title?: string;
}

/** A statement's value: documents (`findOne`, write results) and arrays (`toArray`) in the result views, anything else as shell text. */
export function ValueResult({ value, view, title }: Props) {
  const docs = useMemo(() => documentsOf(value, view.mode), [value, view.mode]);
  const titleText = title && <span className="mono">{title}</span>;

  if (!docs) {
    const text = <pre className="output-value">{formatValue(value, view.zone)}</pre>;
    if (!title) return text;
    return (
      <>
        <header className="result-head">{titleText}</header>
        {text}
      </>
    );
  }
  // An array counts its elements, whether it shows as one root row or spread into the table.
  const count = Array.isArray(value)
    ? `${value.length} ${value.length === 1 ? "elemento" : "elementos"}`
    : "1 documento";
  return (
    <section className="doc-result" aria-label={title ?? "Resultado"}>
      <header className="result-head">
        {titleText}
        <span className="muted small">{count}</span>
      </header>
      <DocumentsView docs={docs} firstNumber={1} mode={view.mode} zone={view.zone} />
    </section>
  );
}
