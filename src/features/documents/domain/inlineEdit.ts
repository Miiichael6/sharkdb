// Editing one primitive value in place (tree view): which values can be edited that way, the text the
// editor starts with, and reading the typed text back as a value of the same BSON type (D19, D20).
import { BSON_TYPE_LABEL, bsonValue, type BsonType, type BsonValue } from "../../shell/domain/bsonValue";
import { doubleText } from "../../shell/domain/bsonFormat";

const ID_FIELD = "_id";

/** Types edited in place (D19); null, dates, ObjectId and containers only change in the document editor. */
const INLINE_EDITABLE_TYPES = ["string", "int32", "int64", "double", "decimal", "boolean"] as const;
export type InlineType = (typeof INLINE_EDITABLE_TYPES)[number];

type InlineValue = Extract<BsonValue, { type: InlineType }>;

const isInlineType = (type: BsonType): type is InlineType => (INLINE_EDITABLE_TYPES as readonly string[]).includes(type);

/** A key `$set` can't address with a dotted path: it would name another field, or none (`a..b`). */
const isUnaddressable = (key: string) => key === "" || key.includes(".") || key.startsWith("$");

/** A one-line field drops line breaks from its value: such a string only changes in the document editor. */
const LINE_BREAK = /[\r\n]/;

/**
 * Whether the value at `path` of a document can be edited in its row: a string, number or boolean
 * (also as an array element), never the `_id` nor anything inside it, nor a string of several lines.
 */
export function isInlineEditable(path: string[], raw: unknown): boolean {
  if (!path.length || path[0] === ID_FIELD || path.some(isUnaddressable)) return false;
  const value = bsonValue(raw);
  if (value.type === "string" && LINE_BREAK.test(value.value)) return false;
  return isInlineType(value.type);
}

/** Type of an editable value; throws for anything `isInlineEditable` refuses. */
function inlineValue(raw: unknown): InlineValue {
  const value = bsonValue(raw);
  if (!isInlineType(value.type)) throw new Error(`${BSON_TYPE_LABEL[value.type]} no se edita en línea`);
  return value as InlineValue;
}

export const inlineTypeOf = (raw: unknown): InlineType => inlineValue(raw).type;

/** The value as typed in the editor: strings as they are (no quotes), numbers without `NumberLong(…)`. */
export function inlineEditText(raw: unknown): string {
  const value = inlineValue(raw);
  if (value.type === "double") return doubleText(value.value);
  return String(value.value);
}

/** The value as the confirmation shows it: strings quoted, so `""` and trailing spaces can be seen. */
export function inlineDisplayText(raw: unknown): string {
  const value = inlineValue(raw);
  return value.type === "string" ? JSON.stringify(value.value) : inlineEditText(raw);
}

export type InlineParse = { value: unknown; error: null } | { value: null; error: string };

const INT32_MIN = -(2n ** 31n);
const INT32_MAX = 2n ** 31n - 1n;
const INT64_MIN = -(2n ** 63n);
const INT64_MAX = 2n ** 63n - 1n;

const INTEGER = /^[+-]?\d+$/;
const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const SPECIAL_NUMBER = /^[+-]?(Infinity|NaN)$/;

/** The same type written the shell way is accepted too: `NumberLong(5)`, `NumberDecimal("1.5")`. */
const SHELL_WRAPPER: Partial<Record<InlineType, RegExp>> = {
  int32: /^NumberInt\(\s*"?([^")]*)"?\s*\)$/,
  int64: /^NumberLong\(\s*"?([^")]*)"?\s*\)$/,
  decimal: /^NumberDecimal\(\s*"?([^")]*)"?\s*\)$/,
};

const ok = (value: unknown): InlineParse => ({ value, error: null });
const fail = (error: string): InlineParse => ({ value: null, error });

const expected = (type: InlineType) => `Se esperaba un ${BSON_TYPE_LABEL[type]}`;

function parseInteger(text: string, type: "int32" | "int64"): InlineParse {
  if (!INTEGER.test(text)) return fail(DECIMAL.test(text) ? `${expected(type)}: un entero, sin decimales` : expected(type));
  const n = BigInt(text);
  const [min, max] = type === "int32" ? [INT32_MIN, INT32_MAX] : [INT64_MIN, INT64_MAX];
  if (n < min || n > max) return fail(`Fuera del rango de ${BSON_TYPE_LABEL[type]} (${min} a ${max})`);
  return ok(type === "int32" ? { $numberInt: n.toString() } : { $numberLong: n.toString() });
}

function parseDouble(text: string): InlineParse {
  if (!DECIMAL.test(text) && !SPECIAL_NUMBER.test(text)) return fail(expected("double"));
  const n = Number(text);
  if (!Number.isFinite(n) && !SPECIAL_NUMBER.test(text)) return fail(`Fuera del rango de ${BSON_TYPE_LABEL.double}`);
  return ok({ $numberDouble: doubleText(String(n)) });
}

function parseDecimal(text: string): InlineParse {
  if (!DECIMAL.test(text) && !SPECIAL_NUMBER.test(text)) return fail(expected("decimal"));
  return ok({ $numberDecimal: text.replace(/^\+/, "") });
}

function parseBoolean(text: string): InlineParse {
  if (text === "true" || text === "false") return ok(text === "true");
  return fail(`${expected("boolean")}: true o false`);
}

/** Numbers may come in the shell wrapper of their own type; spaces at the ends don't count. */
function numberText(text: string, type: InlineType): string {
  const trimmed = text.trim();
  return SHELL_WRAPPER[type]?.exec(trimmed)?.[1].trim() ?? trimmed;
}

/**
 * The typed `text` as canonical Extended JSON of the same type as `original` (D20), or why not. A
 * string is taken literally: `123` stays a String.
 */
export function parseInlineValue(text: string, original: unknown): InlineParse {
  const type = inlineTypeOf(original);
  switch (type) {
    case "string":
      return ok(text);
    case "boolean":
      return parseBoolean(text.trim());
    case "int32":
    case "int64":
      return parseInteger(numberText(text, type), type);
    case "double":
      return parseDouble(numberText(text, type));
    case "decimal":
      return parseDecimal(numberText(text, type));
  }
}

/** A decimal number as `<sign><digits>e<exponent>` without leading or trailing zeros, so `1.50`, `1.5` and `15E-1` match. */
function normalizedDecimal(text: string): string {
  if (SPECIAL_NUMBER.test(text)) return text.replace(/^\+/, "").replace(/^-NaN$/, "NaN");
  const match = /^([+-]?)(\d*)\.?(\d*)(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match) return text;
  const [, sign, whole, fraction, exponent = "0"] = match;
  const digits = (whole + fraction).replace(/^0+/, "");
  if (!digits) return "0";
  const trailing = digits.length - digits.replace(/0+$/, "").length;
  return `${sign === "-" ? "-" : ""}${digits.replace(/0+$/, "")}e${Number(exponent) - fraction.length + trailing}`;
}

/** Whether two values are the same type and value: `5` and `5.0` as Double are equal, the text doesn't matter. */
export function isSameValue(before: unknown, after: unknown): boolean {
  const a = bsonValue(before);
  const b = bsonValue(after);
  if (a.type !== b.type || !isInlineType(a.type)) return false;
  const [x, y] = [a, b] as [InlineValue, InlineValue];
  switch (x.type) {
    case "int64":
      return BigInt(x.value) === BigInt(y.value as string);
    case "double":
      // `Object.is` also matches NaN with NaN.
      return Object.is(Number(x.value), Number(y.value)) || Number(x.value) === Number(y.value);
    case "decimal":
      return normalizedDecimal(x.value) === normalizedDecimal(y.value as string);
    default:
      return x.value === y.value;
  }
}
