import { useEffect, useState } from "react";
import { nextPage, previousPage, rangeLabel, withLimit, withSkip, type Paging } from "../../domain/paging";

interface Props {
  paging: Paging;
  shown: number;
  hasMore: boolean;
  disabled: boolean;
  onChange: (paging: Paging) => void;
}

/** A number field applied on Enter or when leaving it, like Robo 3T's skip and limit boxes. */
function PagingField({ label, value, onCommit }: { label: string; value: number; onCommit: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => (Number(text) === value ? setText(String(value)) : onCommit(Number(text)));
  return (
    <input
      className="paging-field mono"
      aria-label={label}
      title={label}
      inputMode="numeric"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
    />
  );
}

/** `1 – 50   ◀ [skip] [limit] ▶` */
export function PagingBar({ paging, shown, hasMore, disabled, onChange }: Props) {
  return (
    <div className="paging-bar">
      <span className="muted small">{rangeLabel(paging, shown)}</span>
      <button className="ghost" aria-label="Página anterior" disabled={disabled || paging.skip === 0} onClick={() => onChange(previousPage(paging))}>
        ◀
      </button>
      <PagingField label="Saltar (skip)" value={paging.skip} onCommit={(n) => onChange(withSkip(paging, n))} />
      <PagingField label="Documentos por página (limit)" value={paging.limit} onCommit={(n) => onChange(withLimit(paging, n))} />
      <button className="ghost" aria-label="Página siguiente" disabled={disabled || !hasMore} onClick={() => onChange(nextPage(paging))}>
        ▶
      </button>
    </div>
  );
}
