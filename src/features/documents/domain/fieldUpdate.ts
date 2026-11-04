// The write that changes one field of a document (inline edit): only while the field still holds the
// value that was read, and only that field.
import type { Doc } from "../../explorer/domain/mongo";
import { idFilter } from "./documentEdit";

/** Dotted path of a field for queries and `$set`: `EECC.RUC`, `items.0`. */
export const fieldPath = (path: string[]) => path.join(".");

export interface FieldUpdate {
  /** Matches the document only while the field is still `before`. */
  filter: Doc;
  update: Doc;
}

/** Sets `path` of `doc` to `after`, provided it still holds `before` on the server. */
export function fieldUpdate(doc: Doc, path: string[], before: unknown, after: unknown): FieldUpdate {
  const field = fieldPath(path);
  return { filter: { ...idFilter(doc), [field]: before }, update: { $set: { [field]: after } } };
}

/** A copy of `value` with `path` set to `next`; objects and arrays on the way are copied, the rest shared. */
function setAt(value: unknown, path: string[], next: unknown): unknown {
  if (!path.length) return next;
  const [key, ...rest] = path;
  if (Array.isArray(value)) return value.map((item, i) => (String(i) === key ? setAt(item, rest, next) : item));
  const container = value as Doc;
  return { ...container, [key]: setAt(container[key], rest, next) };
}

/** `doc` as it is stored once `fieldUpdate` was applied, keeping its field order. */
export const withField = (doc: Doc, path: string[], next: unknown): Doc => setAt(doc, path, next) as Doc;
