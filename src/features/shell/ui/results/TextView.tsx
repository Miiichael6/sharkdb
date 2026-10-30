import { useMemo } from "react";
import { highlightShell } from "../../../../shared/ui/highlightShell";
import { formatValue, type DateZone } from "../../domain/bsonFormat";

interface Props {
  docs: unknown[];
  firstNumber: number;
  zone: DateZone;
}

/** The documents as shell text, each headed by its number, in the editor's colors and selectable to copy. */
export function TextView({ docs, firstNumber, zone }: Props) {
  const parts = useMemo(
    () => docs.map((doc, i) => ({ number: firstNumber + i, tokens: highlightShell(formatValue(doc, zone)) })),
    [docs, firstNumber, zone],
  );
  return (
    <pre className="result-text" tabIndex={0} aria-label="Resultado en texto">
      {parts.map(({ number, tokens }, i) => (
        <span key={number}>
          {i > 0 && "\n\n"}
          <span className="text-doc-number">{`/* ${number} */`}</span>
          {"\n"}
          {tokens.map((t, j) => (t.className ? <span key={j} className={t.className}>{t.text}</span> : t.text))}
        </span>
      ))}
    </pre>
  );
}
