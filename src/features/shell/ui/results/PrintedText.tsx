import { useMemo } from "react";
import { highlightShell } from "../../../../shared/ui/highlightShell";

interface Props {
  text: string;
  /** From `printjson`: shell JSON, shown as code in the editor's colors. */
  json: boolean;
}

/** A printed line: plain text, or highlighted code when it is JSON. */
export function PrintedText({ text, json }: Props) {
  const tokens = useMemo(() => (json ? highlightShell(text) : null), [text, json]);
  if (!tokens) return <pre className="output-print">{text}</pre>;
  return (
    <pre className="output-print output-json">
      {tokens.map((t, i) => (t.className ? <span key={i} className={t.className}>{t.text}</span> : t.text))}
    </pre>
  );
}
