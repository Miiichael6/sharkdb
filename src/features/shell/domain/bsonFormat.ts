// BSON values written the way the shell (and Robo 3T) shows them: ObjectId("…"), ISODate("…"),
// NumberLong(…). The same syntax is accepted back by the shell when editing.
import { bsonValue, childrenOf, UUID_SUBTYPE, type BsonValue } from "./bsonValue";

/** Whether dates are shown in UTC or in the computer's time zone. */
export type DateZone = "utc" | "local";

/** How literals are written: `exactInts` marks Int32 as `NumberInt(…)` so evaluating the text keeps the type. */
interface Style {
  zone: DateZone;
  exactInts: boolean;
}

const INDENT = "    ";
const MAX_SAFE_LONG = Number.MAX_SAFE_INTEGER;

const pad = (n: number, width = 2) => String(Math.abs(n)).padStart(width, "0");

/** ISO 8601 date: `…Z` in UTC, with the local offset (`…-05:00`) otherwise. */
export function isoDate(ms: number, zone: DateZone): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "Invalid Date";
  if (zone === "utc") return d.toISOString();
  const offset = -d.getTimezoneOffset();
  const sign = offset < 0 ? "-" : "+";
  const date = `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  return `${date}T${time}${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`;
}

/** Doubles always show a decimal part (`1.0`), so they don't read as integers. */
export function doubleText(value: string): string {
  return /^-?\d+$/.test(value) ? `${value}.0` : value;
}

function uuidText(base64: string): string | null {
  const bytes = atob(base64);
  if (bytes.length !== 16) return null;
  const hex = Array.from(bytes, (c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function binaryText(base64: string, subType: string): string {
  const uuid = subType === UUID_SUBTYPE ? uuidText(base64) : null;
  return uuid ? `UUID("${uuid}")` : `BinData(${parseInt(subType, 16)},"${base64}")`;
}

const numberLong = (value: string) =>
  Math.abs(Number(value)) <= MAX_SAFE_LONG ? `NumberLong(${value})` : `NumberLong("${value}")`;

type Scalar = Exclude<BsonValue, { type: "object" | "array" }>;

/** Shell literal of a scalar; containers are written by `formatValue`. */
function scalarLiteral(v: Scalar, { zone, exactInts }: Style): string {
  switch (v.type) {
    case "objectId":
      return `ObjectId("${v.hex}")`;
    case "date":
      return `ISODate("${isoDate(v.ms, zone)}")`;
    case "int32":
      return exactInts ? `NumberInt(${v.value})` : String(v.value);
    case "int64":
      return numberLong(v.value);
    case "double":
      return doubleText(v.value);
    case "decimal":
      return `NumberDecimal("${v.value}")`;
    case "string":
      return JSON.stringify(v.value);
    case "boolean":
      return String(v.value);
    case "null":
    case "undefined":
      return v.type;
    case "minKey":
      return "MinKey()";
    case "maxKey":
      return "MaxKey()";
    case "binary":
      return binaryText(v.base64, v.subType);
    case "regex":
      return `/${v.pattern}/${v.options}`;
    case "timestamp":
      return `Timestamp(${v.t}, ${v.i})`;
    case "code":
      return v.scope ? `Code(${JSON.stringify(v.code)}, ${writeValue(v.scope, { zone, exactInts })})` : `Code(${JSON.stringify(v.code)})`;
    case "symbol":
      return JSON.stringify(v.value);
    case "dbPointer":
      return `DBPointer(${JSON.stringify(v.ns)}, ObjectId("${v.hex}"))`;
  }
}

function writeValue(raw: unknown, style: Style, indent = ""): string {
  const v = bsonValue(raw);
  if (v.type !== "object" && v.type !== "array") return scalarLiteral(v, style);
  const [open, close] = v.type === "object" ? ["{", "}"] : ["[", "]"];
  const children = childrenOf(v);
  if (!children.length) return `${open}${close}`;
  const inner = indent + INDENT;
  const lines = children.map(([key, child]) => {
    const text = writeValue(child, style, inner);
    return v.type === "object" ? `${inner}${JSON.stringify(key)} : ${text}` : `${inner}${text}`;
  });
  return `${open}\n${lines.join(",\n")}\n${indent}${close}`;
}

/** Any value as shell text; documents and arrays span several indented lines. */
export const formatValue = (raw: unknown, zone: DateZone) => writeValue(raw, { zone, exactInts: false });

/** A document as text to edit: evaluated back by the shell, it gives the same BSON types (dates in UTC). */
export const formatEditable = (raw: unknown) => writeValue(raw, { zone: "utc", exactInts: true });

/** The documents of a result as Robo 3T's text view: each one headed by its number. */
export function formatDocuments(docs: unknown[], firstNumber: number, zone: DateZone): string {
  return docs.map((doc, i) => `/* ${firstNumber + i} */\n${formatValue(doc, zone)}`).join("\n\n");
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Short one-line text for the Value column: `{ 3 fields }`, `[ 2 elements ]`, unquoted strings, readable dates. */
export function summarizeValue(raw: unknown, zone: DateZone): string {
  const v = bsonValue(raw);
  switch (v.type) {
    case "object":
      return `{ ${plural(v.fields.length, "field", "fields")} }`;
    case "array":
      return `[ ${plural(v.items.length, "element", "elements")} ]`;
    case "string":
      return v.value;
    case "date":
      return isoDate(v.ms, zone).replace("T", " ");
    default:
      return scalarLiteral(v, { zone, exactInts: false });
  }
}
