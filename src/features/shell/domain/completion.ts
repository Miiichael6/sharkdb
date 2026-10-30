// Context-aware suggestions for the shell editor, from the text before the caret:
//   db.|                   → collections and DB methods
//   db.getCollection('|    → collections
//   db.users.|             → collection methods
//   db.users.find({}).|    → cursor methods
//   db.users.find({ |      → fields sampled from `users` and `$` operators
//   anything else          → shell globals
import type { Doc } from "../../explorer/domain/mongo";
import {
  COLLECTION_METHODS,
  CURSOR_METHODS,
  CURSOR_MODIFIERS,
  CURSOR_SOURCES,
  DB_METHODS,
  GLOBALS,
  OPERATORS,
} from "./shellApi";

export type CompletionContext =
  | { kind: "global" | "db" | "collectionName" | "cursor"; from: number; prefix: string }
  | { kind: "collection" | "field"; from: number; prefix: string; collection: string };

export type SuggestionType = "collection" | "method" | "field" | "operator" | "variable";

export interface Suggestion {
  label: string;
  type: SuggestionType;
}

/** What the suggestions are built from; `fields` are those of the context's collection. */
export interface CompletionData {
  collections: string[];
  fields: string[];
}

const IDENTIFIER_TAIL = /[\w$]*$/;
const FIELD_TAIL = /[\w$.]*$/;
const MEMBER_DOT = /\s*\.\s*$/;
const DB_ROOT = /(?:^|[^\w$.])db$/;
const COLLECTION_NAME_ARG = /getCollection\(\s*(['"])([^'"]*)$/;
/** `db.name` or `db.getCollection('name')` at the end of the text. */
const COLLECTION_EXPR = /(?:^|[^\w$.])db\s*\.\s*(?:getCollection\(\s*(['"])(.+?)\1\s*\)|([A-Za-z_$][\w$]*))$/;
const METHOD_BEFORE_PAREN = /\.\s*([\w$]+)\s*$/;
/** A key position inside an object literal: right after `{` or `,`, maybe opening a quote. */
const KEY_POSITION = /[{,]\s*["']?$/;
/** Maximum depth of the dotted paths taken from sample documents. */
const FIELD_DEPTH = 3;

const OPENERS: Record<string, string> = { ")": "(", "}": "{", "]": "[" };

interface Brackets {
  /** Unclosed brackets, outermost first. */
  open: { char: string; index: number }[];
  /** Index of the opener matching each closer. */
  pairs: Map<number, number>;
  /** The text ends inside a string literal or a comment. */
  inLiteral: boolean;
}

/** Bracket structure of a script prefix, skipping strings and comments. */
function scanBrackets(text: string): Brackets {
  const open: Brackets["open"] = [];
  const pairs = new Map<number, number>();
  let quote: string | null = null;
  let comment: "line" | "block" | null = null;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (comment === "line") {
      if (c === "\n") comment = null;
    } else if (comment === "block") {
      if (c === "*" && text[i + 1] === "/") {
        comment = null;
        i++;
      }
    } else if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
    } else if (c === "/" && text[i + 1] === "/") comment = "line";
    else if (c === "/" && text[i + 1] === "*") comment = "block";
    else if (c === "'" || c === '"' || c === "`") quote = c;
    else if (c === "(" || c === "{" || c === "[") open.push({ char: c, index: i });
    else if (OPENERS[c] && open[open.length - 1]?.char === OPENERS[c]) pairs.set(i, open.pop()!.index);
  }
  return { open, pairs, inLiteral: quote !== null || comment !== null };
}

/** Collection named by the expression ending `text` (`db.x`, `db.getCollection('x')`). */
function collectionAt(text: string): string | null {
  const m = COLLECTION_EXPR.exec(text);
  if (!m) return null;
  const name = m[2] ?? m[3];
  return m[3] && DB_METHODS.includes(name) ? null : name;
}

/** True when `target` (ending in `)`) is a call that returns a cursor, e.g. `db.x.find({}).sort(…)`. */
function returnsCursor(target: string, pairs: Map<number, number>): boolean {
  const open = pairs.get(target.length - 1);
  if (open === undefined) return false;
  const callee = target.slice(0, open);
  const method = METHOD_BEFORE_PAREN.exec(callee)?.[1];
  if (!method) return false;
  const receiver = callee.replace(METHOD_BEFORE_PAREN, "");
  if (CURSOR_SOURCES.includes(method)) return collectionAt(receiver) !== null;
  return CURSOR_MODIFIERS.includes(method) && receiver.endsWith(")") && returnsCursor(receiver, pairs);
}

/** Collection whose method call holds the innermost unclosed `{` (a filter, update, stage…). */
function collectionOfObjectArg(text: string, open: Brackets["open"]): string | null {
  if (open[open.length - 1]?.char !== "{") return null;
  for (let i = open.length - 1; i >= 0; i--) {
    if (open[i].char !== "(") continue;
    const callee = text.slice(0, open[i].index);
    if (!METHOD_BEFORE_PAREN.test(callee)) return null;
    return collectionAt(callee.replace(METHOD_BEFORE_PAREN, ""));
  }
  return null;
}

/** Where the caret is, given the script text before it; null when nothing should be offered. */
export function completionContext(text: string): CompletionContext | null {
  const nameArg = COLLECTION_NAME_ARG.exec(text);
  if (nameArg) return { kind: "collectionName", from: text.length - nameArg[2].length, prefix: nameArg[2] };

  const fieldPrefix = FIELD_TAIL.exec(text)![0];
  const beforeField = text.slice(0, text.length - fieldPrefix.length);
  if (KEY_POSITION.test(beforeField)) {
    const collection = collectionOfObjectArg(beforeField, scanBrackets(beforeField).open);
    if (collection) return { kind: "field", from: beforeField.length, prefix: fieldPrefix, collection };
  }

  const brackets = scanBrackets(text);
  if (brackets.inLiteral) return null;

  const prefix = IDENTIFIER_TAIL.exec(text)![0];
  const from = text.length - prefix.length;
  const before = text.slice(0, from);
  if (!MEMBER_DOT.test(before)) return { kind: "global", from, prefix };

  const target = before.replace(MEMBER_DOT, "");
  if (DB_ROOT.test(target)) return { kind: "db", from, prefix };
  const collection = collectionAt(target);
  if (collection) return { kind: "collection", from, prefix, collection };
  if (target.endsWith(")") && returnsCursor(target, brackets.pairs)) return { kind: "cursor", from, prefix };
  return null;
}

const tagged = (labels: string[], type: SuggestionType): Suggestion[] => labels.map((label) => ({ label, type }));

/** Suggestions for a context, before filtering by prefix (the editor does that). */
export function suggestionsFor(context: CompletionContext, data: CompletionData): Suggestion[] {
  switch (context.kind) {
    case "global":
      return tagged(GLOBALS, "variable");
    case "db":
      return [...tagged(data.collections, "collection"), ...tagged(DB_METHODS, "method")];
    case "collectionName":
      return tagged(data.collections, "collection");
    case "collection":
      return tagged(COLLECTION_METHODS, "method");
    case "cursor":
      return tagged(CURSOR_METHODS, "method");
    case "field":
      return context.prefix.startsWith("$") ? tagged(OPERATORS, "operator") : [...tagged(data.fields, "field"), ...tagged(OPERATORS, "operator")];
  }
}

/** Dotted field paths found in sample documents (Extended JSON wrappers like `{$oid}` are values). */
export function fieldPaths(docs: Doc[], maxDepth = FIELD_DEPTH): string[] {
  const paths = new Set<string>();
  const walk = (value: unknown, path: string, depth: number) => {
    if (depth > maxDepth || value === null || typeof value !== "object" || Array.isArray(value)) return;
    const keys = Object.keys(value);
    if (keys.some((k) => k.startsWith("$"))) return;
    for (const k of keys) {
      const p = path ? `${path}.${k}` : k;
      paths.add(p);
      walk((value as Doc)[k], p, depth + 1);
    }
  };
  docs.forEach((d) => walk(d, "", 1));
  return [...paths].sort();
}
