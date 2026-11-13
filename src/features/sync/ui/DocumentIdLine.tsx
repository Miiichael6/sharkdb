import type { ReactNode } from "react";
import { bsonValue } from "../../shell/domain/bsonValue";
import { summarizeValue } from "../../shell/domain/bsonFormat";
import { TypeIcon } from "../../shell/ui/results/TypeIcon";

/** A sheet with folded corner: one document. */
const DOCUMENT_ICON = (
  <svg className="doc-sync-doc-icon" width="14" height="14" viewBox="0 0 16 16" aria-hidden>
    <path d="M4 1.5h5.5L13 5v9.5H4z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M9.5 1.5V5H13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M6 8.5h5M6 11h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

interface Props {
  /** The `_id`, as canonical Extended JSON. */
  id: unknown;
  /** Position among the picked documents, from 0. */
  index: number;
  /** Shown at the end of the line (e.g. how many fields the document has). */
  extra?: ReactNode;
}

/** One picked document by its `_id`: number, the value's type and the value, as both sync windows list it. */
export function DocumentIdLine({ id, index, extra }: Props) {
  const text = summarizeValue(id, "utc");
  return (
    <div className="doc-sync-doc-head">
      {DOCUMENT_ICON}
      <span className="muted small">#{index + 1}</span>
      <TypeIcon type={bsonValue(id).type} />
      <span className="mono small">_id</span>
      <b className="mono ellipsis" title={text}>
        {text}
      </b>
      {extra && (
        <>
          <span className="spacer" />
          {extra}
        </>
      )}
    </div>
  );
}
