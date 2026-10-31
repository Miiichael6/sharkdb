// Document validation of a collection (`$jsonSchema`): what the server has, read from
// `listCollections`, and the `collMod` command that changes it.
import type { Doc } from "./mongo";

export type ValidationLevel = "moderate" | "strict";
export type ValidationAction = "error" | "warn";
/** Fields the schema doesn't list: refused (`additionalProperties: false`) or allowed. */
export type ExtraFields = "rechazar" | "permitir";

export interface ValidationSettings {
  level: ValidationLevel;
  action: ValidationAction;
  extraFields: ExtraFields;
}

export interface CollectionValidation extends ValidationSettings {
  /**
   * What the editor shows: the `$jsonSchema`, or the whole validator when it holds more than that
   * (query operators set from a script). Null when the collection has no validation.
   */
  rule: Doc | null;
  wholeValidator: boolean;
}

/** What MongoDB applies when the collection doesn't store a level or an action. */
export const DEFAULT_LEVEL: ValidationLevel = "strict";
export const DEFAULT_ACTION: ValidationAction = "error";

const SCHEMA_KEY = "$jsonSchema";
const ID_FIELD = "_id";

/** Any value: `_id` is always allowed at the root, whatever its type. */
const ANY_VALUE: Doc = {};

export const EMPTY_RULE = "Escribe el esquema, o usa Quitar validación para quitarla";

const isObject = (value: unknown): value is Doc => typeof value === "object" && value !== null && !Array.isArray(value);

const onlySchema = (validator: Doc) => {
  const keys = Object.keys(validator);
  return keys.length === 1 && keys[0] === SCHEMA_KEY && isObject(validator[SCHEMA_KEY]);
};

/** The `$jsonSchema` a validator holds at its root, if any. */
const schemaOf = (validator: Doc): Doc | null => (isObject(validator[SCHEMA_KEY]) ? validator[SCHEMA_KEY] : null);

/** The validation a collection has on the server, from its `listCollections` options. */
export function readValidation(options: Doc = {}): CollectionValidation {
  const validator = isObject(options.validator) && Object.keys(options.validator).length ? options.validator : null;
  const wholeValidator = !!validator && !onlySchema(validator);
  const schema = validator && schemaOf(validator);
  return {
    rule: validator && (wholeValidator ? validator : schema),
    wholeValidator,
    level: options.validationLevel === "moderate" ? "moderate" : DEFAULT_LEVEL,
    action: options.validationAction === "warn" ? "warn" : DEFAULT_ACTION,
    extraFields: schema?.additionalProperties === false ? "rechazar" : "permitir",
  };
}

/**
 * The schema with `additionalProperties` set on every object that lists `properties`: false to
 * refuse extra fields (`_id` stays allowed at the root), removed to allow them.
 */
export function withExtraFields(schema: Doc, extraFields: ExtraFields, root = true): Doc {
  const out: Doc = {};
  const nested = (value: unknown) => (isObject(value) ? withExtraFields(value, extraFields, false) : value);
  for (const [key, value] of Object.entries(schema)) {
    if (key === "additionalProperties" && value === false) continue;
    if (SCHEMA_MAPS.includes(key) && isObject(value)) {
      out[key] = Object.fromEntries(Object.entries(value).map(([field, s]) => [field, nested(s)]));
    } else if (NESTED_SCHEMAS.includes(key)) {
      out[key] = Array.isArray(value) ? value.map(nested) : nested(value);
    } else {
      out[key] = value;
    }
  }
  if (extraFields === "rechazar" && isObject(out.properties)) {
    out.additionalProperties = false;
    if (root && !(ID_FIELD in out.properties)) out.properties = { [ID_FIELD]: ANY_VALUE, ...out.properties };
  }
  return out;
}

/** Keywords whose value maps names to schemas. */
const SCHEMA_MAPS = ["properties", "patternProperties"];
/** Keywords whose value is a schema or a list of them. */
const NESTED_SCHEMAS = ["items", "anyOf", "allOf", "oneOf", "not"];

/** The validator to store: the edited rule as it is when it's the whole validator, else wrapped in `$jsonSchema`. */
export function validatorFrom(rule: Doc, wholeValidator: boolean, extraFields: ExtraFields): Doc {
  if (!Object.keys(rule).length) throw EMPTY_RULE;
  if (!wholeValidator) return { [SCHEMA_KEY]: withExtraFields(rule, extraFields) };
  const schema = schemaOf(rule);
  return schema ? { ...rule, [SCHEMA_KEY]: withExtraFields(schema, extraFields) } : rule;
}

/** `collMod` that sets the validation of `coll`; the command name goes first, as the server requires. */
export const collModCommand = (coll: string, validator: Doc, { level, action }: ValidationSettings): Doc => ({
  collMod: coll,
  validator,
  validationLevel: level,
  validationAction: action,
});

/** `collMod` that takes the validation off `coll`. */
export const removeValidationCommand = (coll: string): Doc => ({ collMod: coll, validator: {} });
