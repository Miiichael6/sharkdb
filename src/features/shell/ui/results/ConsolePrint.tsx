import type { DateZone } from "../../domain/bsonFormat";
import { bsonValue, isContainer } from "../../domain/bsonValue";
import { topLevelText } from "../../domain/consolePreview";
import { ConsoleValue } from "./ConsoleValue";
import { PrintedText } from "./PrintedText";

interface Props {
  text: string;
  /** From `printjson`: shown as code. */
  json: boolean;
  /** The printed arguments when one is not text; `null` shows `text` as it is. */
  values: unknown[] | null;
  zone: DateZone;
}

/** One printed argument: text as it is, documents and arrays to open, other values in their type's color. */
function PrintedValue({ value, zone }: { value: unknown; zone: DateZone }) {
  const v = bsonValue(value);
  if (v.type === "string") return <span className="console-printed">{v.value}</span>;
  if (isContainer(v)) return <ConsoleValue value={value} zone={zone} />;
  return <span className={`console-printed bson-${v.type}`}>{topLevelText(value, zone)}</span>;
}

/** A `print` line, like `console.log` in the browser: each argument by its type, one after another. */
export function ConsolePrint({ text, values, json, zone }: Props) {
  if (!values) return <PrintedText text={text} json={json} />;
  return (
    <div className="console-print">
      {values.map((value, i) => (
        <PrintedValue key={i} value={value} zone={zone} />
      ))}
    </div>
  );
}
