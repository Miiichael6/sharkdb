// One-line previews of console values, like the browser's DevTools: `Array(3) [{…}, {…}, {…}]`,
// `{_id: ObjectId("…"), name: "Lima", tags: Array(2)}`. Scalars keep their shell literal.
import { formatValue, type DateZone } from "./bsonFormat";
import { bsonValue, type BsonType } from "./bsonValue";

/** Longest preview; past it the entries stop and `…` closes the list. */
export const MAX_PREVIEW_CHARS = 100;
const ELLIPSIS = "…";

/** `Array(3)`; `Array(50+)` when more elements are still to be read. */
export const arrayLabel = (count: number, more = false) => `Array(${count}${more ? "+" : ""})`;

/** A scalar's shell literal, but numbers like JavaScript: every JS number arrives as Double, so `120`, not `120.0`. */
function consoleLiteral(raw: unknown, zone: DateZone): string {
  const v = bsonValue(raw);
  return v.type === "double" ? String(Number(v.value)) : formatValue(raw, zone);
}

/** What colors a piece of a preview: its BSON type, a field name, a class label, or nothing (brackets, commas). */
export type PreviewTone = BsonType | "key" | "label" | null;

/** A piece of a preview, so each one gets its type's color. */
export interface PreviewPart {
  text: string;
  tone: PreviewTone;
}

const part = (text: string, tone: PreviewTone = null): PreviewPart => ({ text, tone });
const lengthOf = (parts: readonly PreviewPart[]) => parts.reduce((sum, p) => sum + p.text.length, 0);

/** A value one level down: containers only by their shape, as DevTools shows them inside a preview. */
function nestedParts(raw: unknown, zone: DateZone): PreviewPart[] {
  const v = bsonValue(raw);
  if (v.type === "object") return [part(v.fields.length ? `{${ELLIPSIS}}` : "{}", "object")];
  if (v.type === "array") return [part(arrayLabel(v.items.length), "array")];
  return [part(consoleLiteral(raw, zone), v.type)];
}

/** `[a, b, …]` with as many parts as fit in MAX_PREVIEW_CHARS; parts past the cut aren't even written. */
function joinFitting<T>(items: readonly T[], write: (item: T) => PreviewPart[], open: string, close: string): PreviewPart[] {
  const parts = [part(open)];
  let length = 0;
  for (const [i, item] of items.entries()) {
    const next = write(item);
    const added = (i ? 2 : 0) + lengthOf(next);
    if (length + added > MAX_PREVIEW_CHARS) {
      parts.push(part(`${i ? ", " : ""}${ELLIPSIS}`));
      break;
    }
    if (i) parts.push(part(", "));
    parts.push(...next);
    length += added;
  }
  parts.push(part(close));
  return parts;
}

export interface PreviewOptions {
  /** Class name written before a document: `WriteResult {…}`. */
  label?: string | null;
  /** An array still has elements to read (an open cursor): `Array(50+)`. */
  more?: boolean;
}

/**
 * A value on one line, in pieces: arrays as `Array(n) [ … ]`, documents as `{key: value, …}`, anything
 * else as its shell literal (`ObjectId("…")`, `"text"`, `1.0`).
 */
export function previewParts(raw: unknown, zone: DateZone, { label = null, more = false }: PreviewOptions = {}): PreviewPart[] {
  const v = bsonValue(raw);
  const write = (item: unknown) => nestedParts(item, zone);
  if (v.type === "array") return [part(arrayLabel(v.items.length, more), "array"), part(" "), ...joinFitting(v.items, write, "[", "]")];
  if (v.type !== "object") return [part(consoleLiteral(raw, zone), v.type)];
  const fields = joinFitting(v.fields, ([key, child]) => [part(key, "key"), part(": "), ...write(child)], "{", "}");
  return label ? [part(label, "label"), part(" "), ...fields] : fields;
}

/** The same preview as plain text. */
export const valuePreview = (raw: unknown, zone: DateZone, options?: PreviewOptions): string =>
  previewParts(raw, zone, options)
    .map((p) => p.text)
    .join("");

/**
 * A scalar the script returned, as the console prints it: numbers like JavaScript and strings without
 * quotes (`db` gives its name).
 */
export function topLevelText(raw: unknown, zone: DateZone): string {
  const v = bsonValue(raw);
  return v.type === "string" ? v.value : consoleLiteral(raw, zone);
}
