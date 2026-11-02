import type { Doc, IndexSpec } from "./mongo";

/** Same naming MongoDB uses when no name is given: `a_1_b_-1`. */
export function defaultIndexName(key: Doc): string {
  return Object.entries(key)
    .map(([k, v]) => `${k}_${v}`)
    .join("_");
}

/** `listIndexes` adds server-managed fields that `createIndexes` rejects. */
export function creatableSpec(spec: IndexSpec): IndexSpec {
  const { v: _v, ns: _ns, ...rest } = spec;
  return rest as IndexSpec;
}

/** Options the index dialog edits; the rest (`collation`, `hidden`, `2dsphereIndexVersion`...) it doesn't show. */
const FORM_FIELDS = [
  "name",
  "key",
  "unique",
  "sparse",
  "background",
  "expireAfterSeconds",
  "partialFilterExpression",
  "default_language",
  "language_override",
  "weights",
] as const;

/**
 * Editing usually recreates the index, so the options the dialog doesn't show come from the original:
 * dropping a case-insensitive `collation` from a `unique` index would let duplicates in.
 */
export function editedSpec(original: IndexSpec, form: IndexSpec): IndexSpec {
  const kept: Record<string, unknown> = { ...creatableSpec(original) };
  for (const field of FORM_FIELDS) delete kept[field];
  return { ...kept, ...form };
}

/** Options `collMod` changes on an existing index without rebuilding it. */
const IN_PLACE_FIELDS = ["expireAfterSeconds", "hidden"] as const;

/** Only affects how the index is built, so it's not a difference between two built indexes. */
const BUILD_ONLY_FIELDS = ["background"];

/** The index's options as the server applies them: `false` flags and absent fields are the same. */
function effective(spec: IndexSpec): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(creatableSpec(spec)))
    if (v !== undefined && v !== false && !BUILD_ONLY_FIELDS.includes(k)) out[k] = JSON.stringify(v);
  return out;
}

/**
 * The `collMod` that turns `old` into `next` in place, when they only differ in its TTL or
 * `hidden`: the index stays (with its `unique`) instead of being dropped and rebuilt. `null` when
 * that isn't enough: other options change, or the TTL is added or removed (collMod only changes
 * an existing one).
 */
export function inPlaceIndexChange(coll: string, old: IndexSpec, next: IndexSpec): Doc | null {
  const [a, b] = [effective(old), effective(next)];
  const fields = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const f of fields) if (!(IN_PLACE_FIELDS as readonly string[]).includes(f) && a[f] !== b[f]) return null;
  if ((old.expireAfterSeconds == null) !== (next.expireAfterSeconds == null)) return null;
  const index: Doc = { name: old.name };
  if (a.expireAfterSeconds !== b.expireAfterSeconds) index.expireAfterSeconds = next.expireAfterSeconds;
  if (a.hidden !== b.hidden) index.hidden = !!next.hidden;
  return { collMod: coll, index };
}

export function parseJsonObject(text: string, field: string): Doc {
  try {
    const v = JSON.parse(text);
    if (v && typeof v === "object" && !Array.isArray(v)) return v;
  } catch {
    // fall through
  }
  throw `${field}: JSON inválido (debe ser un objeto)`;
}
