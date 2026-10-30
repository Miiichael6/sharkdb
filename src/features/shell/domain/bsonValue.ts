// BSON values as they arrive from the shell (canonical Extended JSON), told apart by type.

export type BsonValue =
  | { type: "objectId"; hex: string }
  | { type: "date"; ms: number }
  | { type: "int32"; value: number }
  | { type: "int64"; value: string }
  | { type: "double"; value: string }
  | { type: "decimal"; value: string }
  | { type: "string"; value: string }
  | { type: "boolean"; value: boolean }
  | { type: "null" }
  | { type: "undefined" }
  | { type: "minKey" }
  | { type: "maxKey" }
  | { type: "binary"; base64: string; subType: string }
  | { type: "regex"; pattern: string; options: string }
  | { type: "timestamp"; t: number; i: number }
  | { type: "code"; code: string; scope: Record<string, unknown> | null }
  | { type: "symbol"; value: string }
  | { type: "dbPointer"; ns: string; hex: string }
  | { type: "object"; fields: [string, unknown][] }
  | { type: "array"; items: unknown[] };

export type BsonType = BsonValue["type"];

/** Type names shown in the Type column, as Robo 3T names them. */
export const BSON_TYPE_LABEL: Record<BsonType, string> = {
  objectId: "ObjectId",
  date: "Date",
  int32: "Int32",
  int64: "Int64",
  double: "Double",
  decimal: "Decimal128",
  string: "String",
  boolean: "Boolean",
  null: "Null",
  undefined: "Undefined",
  minKey: "MinKey",
  maxKey: "MaxKey",
  binary: "Binary",
  regex: "Regular Expression",
  timestamp: "Timestamp",
  code: "Code",
  symbol: "Symbol",
  dbPointer: "DBPointer",
  object: "Object",
  array: "Array",
};

/** Binary subtype of UUIDs (RFC 4122), shown as `UUID("…")`. */
export const UUID_SUBTYPE = "04";

const INT32_MIN = -(2 ** 31);
const INT32_MAX = 2 ** 31 - 1;

type Json = Record<string, unknown>;

const isPlainObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/** `v` has exactly these keys: wrappers are only recognised when nothing else is beside them. */
function hasKeys(v: Json, ...keys: string[]): boolean {
  const own = Object.keys(v);
  return own.length === keys.length && keys.every((k) => k in v);
}

function dateMs(v: unknown): number | null {
  if (isPlainObject(v) && hasKeys(v, "$numberLong")) return Number(v.$numberLong);
  if (typeof v === "string") return Date.parse(v);
  if (typeof v === "number") return v;
  return null;
}

function plainNumber(n: number): BsonValue {
  if (Number.isInteger(n) && n >= INT32_MIN && n <= INT32_MAX) return { type: "int32", value: n };
  return { type: "double", value: String(n) };
}

/** Recognises an Extended JSON wrapper (`{ "$oid": … }`, `{ "$date": … }`…), or null for a plain document. */
function wrapper(v: Json): BsonValue | null {
  if (hasKeys(v, "$oid") && typeof v.$oid === "string") return { type: "objectId", hex: v.$oid };
  if (hasKeys(v, "$date")) {
    const ms = dateMs(v.$date);
    return ms === null ? null : { type: "date", ms };
  }
  if (hasKeys(v, "$numberInt")) return { type: "int32", value: Number(v.$numberInt) };
  if (hasKeys(v, "$numberLong")) return { type: "int64", value: String(v.$numberLong) };
  if (hasKeys(v, "$numberDouble")) return { type: "double", value: String(v.$numberDouble) };
  if (hasKeys(v, "$numberDecimal")) return { type: "decimal", value: String(v.$numberDecimal) };
  if (hasKeys(v, "$binary") && isPlainObject(v.$binary)) {
    return { type: "binary", base64: String(v.$binary.base64), subType: String(v.$binary.subType) };
  }
  if (hasKeys(v, "$regularExpression") && isPlainObject(v.$regularExpression)) {
    const { pattern, options } = v.$regularExpression;
    return { type: "regex", pattern: String(pattern), options: String(options ?? "") };
  }
  if (hasKeys(v, "$timestamp") && isPlainObject(v.$timestamp)) {
    return { type: "timestamp", t: Number(v.$timestamp.t), i: Number(v.$timestamp.i) };
  }
  if (hasKeys(v, "$minKey")) return { type: "minKey" };
  if (hasKeys(v, "$maxKey")) return { type: "maxKey" };
  if (hasKeys(v, "$undefined")) return { type: "undefined" };
  if (hasKeys(v, "$code")) return { type: "code", code: String(v.$code), scope: null };
  if (hasKeys(v, "$code", "$scope") && isPlainObject(v.$scope)) return { type: "code", code: String(v.$code), scope: v.$scope };
  if (hasKeys(v, "$symbol")) return { type: "symbol", value: String(v.$symbol) };
  if (hasKeys(v, "$dbPointer") && isPlainObject(v.$dbPointer)) {
    const id = v.$dbPointer.$id;
    return { type: "dbPointer", ns: String(v.$dbPointer.$ref), hex: isPlainObject(id) ? String(id.$oid) : String(id) };
  }
  return null;
}

/** Tells which BSON type an Extended JSON value holds. */
export function bsonValue(v: unknown): BsonValue {
  if (v === null) return { type: "null" };
  if (v === undefined) return { type: "undefined" };
  if (typeof v === "string") return { type: "string", value: v };
  if (typeof v === "boolean") return { type: "boolean", value: v };
  if (typeof v === "number") return plainNumber(v);
  if (Array.isArray(v)) return { type: "array", items: v };
  if (isPlainObject(v)) return wrapper(v) ?? { type: "object", fields: Object.entries(v) };
  return { type: "string", value: String(v) };
}

/** Child entries of a document or array (array keys are the indexes), or none for scalars. */
export function childrenOf(value: BsonValue): [string, unknown][] {
  if (value.type === "object") return value.fields;
  if (value.type === "array") return value.items.map((item, i) => [String(i), item]);
  return [];
}

export const isContainer = (value: BsonValue) => value.type === "object" || value.type === "array";
