import { useMemo } from "react";
import { formatDocuments, type DateZone } from "../../domain/bsonFormat";

interface Props {
  docs: unknown[];
  firstNumber: number;
  zone: DateZone;
}

/** The documents as shell text, each headed by its number, selectable to copy. */
export function TextView({ docs, firstNumber, zone }: Props) {
  const text = useMemo(() => formatDocuments(docs, firstNumber, zone), [docs, firstNumber, zone]);
  return (
    <pre className="result-text" tabIndex={0} aria-label="Resultado en texto">
      {text}
    </pre>
  );
}
