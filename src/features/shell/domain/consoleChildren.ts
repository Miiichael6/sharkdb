// What an expanded console value shows below it, like DevTools: its fields, or a long array split
// into ranges `[0 … 99]`, `[100 … 199]` that open one at a time.
import { bsonValue, childrenOf } from "./bsonValue";

/** Elements shown directly; a longer array is split into ranges of this size. */
export const ARRAY_CHUNK = 100;

export type ConsoleChild =
  | { kind: "field"; key: string; value: unknown }
  /** Elements `from`..`to` (both included) of the array. */
  | { kind: "range"; from: number; to: number };

/** `[0 … 99]` */
export const rangeLabel = (from: number, to: number) => `[${from} … ${to}]`;

/** The fields of a document, or the elements of an array (in ranges when it's longer than ARRAY_CHUNK). */
export function consoleChildren(raw: unknown): ConsoleChild[] {
  const v = bsonValue(raw);
  if (v.type === "array" && v.items.length > ARRAY_CHUNK) return arrayRanges(v.items.length);
  return childrenOf(v).map(([key, value]) => ({ kind: "field", key, value }));
}

function arrayRanges(length: number): ConsoleChild[] {
  const ranges: ConsoleChild[] = [];
  for (let from = 0; from < length; from += ARRAY_CHUNK) ranges.push({ kind: "range", from, to: Math.min(from + ARRAY_CHUNK, length) - 1 });
  return ranges;
}

/** The elements of a range, keyed by their index in the whole array. */
export function rangeItems(items: unknown[], from: number, to: number): ConsoleChild[] {
  return items.slice(from, to + 1).map((value, i) => ({ kind: "field", key: String(from + i), value }));
}
