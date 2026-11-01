import { useMemo } from "react";
import { CodeEditor } from "../../../../shared/ui/CodeEditor";
import { formatValue, type DateZone } from "../../domain/bsonFormat";

interface Props {
  docs: unknown[];
  firstNumber: number;
  zone: DateZone;
}

/**
 * The documents as shell text, each headed by its number, selectable to copy. In a read-only editor,
 * which only draws and colors the lines on screen: a page of big documents runs to tens of thousands.
 */
export function TextView({ docs, firstNumber, zone }: Props) {
  const text = useMemo(
    () => docs.map((doc, i) => `/* ${firstNumber + i} */\n${formatValue(doc, zone)}`).join("\n\n"),
    [docs, firstNumber, zone],
  );
  return <CodeEditor className="result-text" value={text} readOnly />;
}
