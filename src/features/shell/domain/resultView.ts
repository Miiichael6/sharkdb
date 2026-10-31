// How a result's documents are laid out in the tree and table views.
import { formatValue, summarizeValue, type DateZone } from "./bsonFormat";
import { BSON_TYPE_LABEL, bsonValue, childrenOf, isContainer, type BsonType, type BsonValue } from "./bsonValue";

export type ViewMode = "tree" | "table" | "text";

export const VIEW_MODES: { mode: ViewMode; label: string }[] = [
  { mode: "tree", label: "Árbol" },
  { mode: "table", label: "Tabla" },
  { mode: "text", label: "Texto" },
];

/** Keys of a value from its document's root; empty for the document itself. */
export type KeyPath = string[];

export interface TreeRow {
  /** Unique within the shown documents (document index + key path). */
  id: string;
  docIndex: number;
  path: KeyPath;
  depth: number;
  key: string;
  /** One-line value: the value itself, or `{ N fields }` / `[ N elements ]`. */
  value: string;
  type: BsonType;
  typeLabel: string;
  expandable: boolean;
  expanded: boolean;
  raw: unknown;
}

// Can't appear in a key typed by hand, so ids of different paths never clash.
const PATH_SEPARATOR = "\u001f";

export const rowId = (docIndex: number, path: KeyPath) => [docIndex, ...path].join(PATH_SEPARATOR);

/** Path as the shell writes it in queries: `address.city`, `items.0.name`. */
export const dottedPath = (path: KeyPath) => path.join(".");

/** Key of a document's root row, like Robo 3T: `(1) ObjectId("…")`, numbered from 1. */
export function documentKey(doc: unknown, number: number, zone: DateZone): string {
  const id = childrenOf(bsonValue(doc)).find(([key]) => key === "_id");
  return id ? `(${number}) ${summarizeValue(id[1], zone)}` : `(${number})`;
}

/** What an expanded row shows below it; empty when the row can't be expanded. */
const expandableChildren = (value: BsonValue) => (isContainer(value) ? childrenOf(value) : []);

function pushRows(rows: TreeRow[], raw: unknown, docIndex: number, path: KeyPath, key: string, expanded: ReadonlySet<string>, zone: DateZone) {
  const value = bsonValue(raw);
  const children = expandableChildren(value);
  const id = rowId(docIndex, path);
  const expandable = children.length > 0;
  const isOpen = expandable && expanded.has(id);
  rows.push({
    id,
    docIndex,
    path,
    depth: path.length,
    key,
    value: summarizeValue(raw, zone),
    type: value.type,
    typeLabel: BSON_TYPE_LABEL[value.type],
    expandable,
    expanded: isOpen,
    raw,
  });
  if (isOpen) children.forEach(([k, child]) => pushRows(rows, child, docIndex, [...path, k], k, expanded, zone));
}

/** The rows on screen: one per document and, under each expanded row, one per child. */
export function visibleTreeRows(docs: unknown[], firstNumber: number, expanded: ReadonlySet<string>, zone: DateZone): TreeRow[] {
  const rows: TreeRow[] = [];
  docs.forEach((doc, i) => pushRows(rows, doc, i, [], documentKey(doc, firstNumber + i, zone), expanded, zone));
  return rows;
}

export type TreeColumn = "key" | "value" | "type";

/**
 * What Ctrl+C copies from a tree cell, like Robo 3T: the field name, the value (strings as plain text,
 * anything else as shell syntax: `ObjectId("…")`, a whole sub-document) or the type name. A document's
 * own key copies the whole document.
 */
export function cellText(row: TreeRow, column: TreeColumn, doc: unknown, zone: DateZone): string {
  if (column === "type") return row.typeLabel;
  if (column === "key") return row.depth === 0 ? formatValue(doc, zone) : row.key;
  return valueText(row.raw, zone);
}

/** A value to copy as itself: strings as plain text, anything else in shell syntax. */
export function valueText(raw: unknown, zone: DateZone): string {
  const value = bsonValue(raw);
  // An empty string copies as empty too, so nothing copied earlier is left on the clipboard.
  return value.type === "string" ? value.value : formatValue(raw, zone);
}

export function toggleExpanded(expanded: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(expanded);
  if (!next.delete(id)) next.add(id);
  return next;
}

function addExpandable(ids: Set<string>, raw: unknown, docIndex: number, path: KeyPath) {
  const children = expandableChildren(bsonValue(raw));
  if (!children.length) return;
  ids.add(rowId(docIndex, path));
  children.forEach(([k, child]) => addExpandable(ids, child, docIndex, [...path, k]));
}

/** Opens the row at `path` (holding `raw`) and every container below it. */
export function expandRecursively(expanded: ReadonlySet<string>, raw: unknown, docIndex: number, path: KeyPath): Set<string> {
  const next = new Set(expanded);
  addExpandable(next, raw, docIndex, path);
  return next;
}

/** Closes the row at `path` and every row below it, so reopening it shows one level again. */
export function collapseRecursively(expanded: ReadonlySet<string>, docIndex: number, path: KeyPath): Set<string> {
  const id = rowId(docIndex, path);
  return new Set([...expanded].filter((x) => x !== id && !x.startsWith(id + PATH_SEPARATOR)));
}

/** The value at `path` inside `doc`, or null if some key along the way is missing. */
export function lookup(doc: unknown, path: KeyPath): { value: unknown } | null {
  let current = doc;
  for (const key of path) {
    const entry = childrenOf(bsonValue(current)).find(([k]) => k === key);
    if (!entry) return null;
    current = entry[1];
  }
  return { value: current };
}

export interface TableColumn {
  id: string;
  path: KeyPath;
  label: string;
}

/**
 * One column per field across all documents, in order of first appearance. Embedded documents
 * are spread into dotted columns (`address.city`); arrays stay as one column.
 */
export function tableColumns(docs: unknown[]): TableColumn[] {
  const columns = new Map<string, TableColumn>();
  const visit = (raw: unknown, path: KeyPath) => {
    const value = bsonValue(raw);
    if (value.type === "object" && value.fields.length) {
      value.fields.forEach(([key, child]) => visit(child, [...path, key]));
      return;
    }
    const id = rowId(0, path);
    if (!columns.has(id)) columns.set(id, { id, path, label: dottedPath(path) });
  };
  docs.forEach((doc) => childrenOf(bsonValue(doc)).forEach(([key, child]) => visit(child, [key])));
  return [...columns.values()];
}

/**
 * The roots a non-cursor result shows in `mode`: a document on its own, or an array as one root row
 * like Robo 3T's `(1) [ N elements ]`. The table, which needs documents as rows, spreads an array of
 * documents (`toArray()`) instead. Null for anything else (numbers, strings…).
 */
export function documentsOf(value: unknown, mode: ViewMode): unknown[] | null {
  const v = bsonValue(value);
  if (v.type === "object") return [value];
  if (v.type !== "array") return null;
  if (mode === "table" && v.items.length && v.items.every((item) => bsonValue(item).type === "object")) return v.items;
  return [value];
}
