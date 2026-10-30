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

export function parseJsonObject(text: string, field: string): Doc {
  try {
    const v = JSON.parse(text);
    if (v && typeof v === "object" && !Array.isArray(v)) return v;
  } catch {
    // fall through
  }
  throw `${field}: JSON inválido (debe ser un objeto)`;
}
