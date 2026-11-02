// Document validation of a collection (`$jsonSchema`): what the server has, read from
// `listCollections`, and the `collMod` command that changes it.
import type { ConfirmRequest } from "../../../shared/domain/confirmation";
import type { TargetWhere } from "../../../shared/domain/documentTarget";
import type { Doc } from "./mongo";

export type ValidationLevel = "off" | "moderate" | "strict";
/** `errorAndLog` only exists from MongoDB 8.0. */
export type ValidationAction = "error" | "warn" | "errorAndLog";
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

/** The levels the window goes through; every server version accepts them. */
export const VALIDATION_LEVELS: ValidationLevel[] = ["off", "moderate", "strict"];
const BASE_ACTIONS: ValidationAction[] = ["error", "warn"];

/**
 * The actions the window goes through: `errorAndLog` only when the collection already has it,
 * since older servers refuse it.
 */
export const validationActions = (current: ValidationAction): ValidationAction[] =>
  current === "errorAndLog" ? [...BASE_ACTIONS, "errorAndLog"] : BASE_ACTIONS;

const pick = <T extends string>(value: unknown, known: readonly T[], fallback: T): T =>
  known.includes(value as T) ? (value as T) : fallback;

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
    level: pick(options.validationLevel, VALIDATION_LEVELS, DEFAULT_LEVEL),
    action: pick(options.validationAction, validationActions("errorAndLog"), DEFAULT_ACTION),
    extraFields: schema?.additionalProperties === false ? "rechazar" : "permitir",
  };
}

export const NO_FIELDS_TO_KEEP =
  'Campos extra "rechazar" necesita que el esquema nombre campos (en properties o required); si no, solo se admitiría _id';

/**
 * The schema with `additionalProperties` set at its root: false to refuse fields it doesn't name,
 * removed to allow them. Nested objects keep whatever the user wrote.
 *
 * `additionalProperties` only sees the `properties` beside it, so closing the root also lists
 * there `_id` and the fields that `required` and the `anyOf`/`oneOf`/`allOf` branches name;
 * otherwise no document could pass. A schema that names no field can't be closed: it throws.
 */
export function withExtraFields(schema: Doc, extraFields: ExtraFields): Doc {
  const { additionalProperties, ...rest } = schema;
  if (extraFields === "permitir") return additionalProperties === false ? rest : schema;
  const own = isObject(rest.properties) ? rest.properties : {};
  const named = [...Object.keys(own), ...requiredFields(rest), ...branchFields(rest)];
  if (!named.length) throw NO_FIELDS_TO_KEEP;
  const missing = [ID_FIELD, ...named].filter((field) => !(field in own));
  const properties = Object.fromEntries([...new Set(missing)].map((field) => [field, ANY_VALUE]));
  return { ...rest, properties: { ...properties, ...own }, additionalProperties: false };
}

/** Keywords whose branches all describe the same object as the schema that holds them. */
const BRANCHES = ["anyOf", "oneOf", "allOf"];

/** The fields `schema` requires: they must be allowed, or no document could pass. */
const requiredFields = (schema: Doc): string[] =>
  Array.isArray(schema.required) ? schema.required.filter((field): field is string => typeof field === "string") : [];

/** The fields that the combinator branches of `schema` name, at any depth of combinators. */
function branchFields(schema: Doc): string[] {
  return BRANCHES.flatMap((key) => (Array.isArray(schema[key]) ? schema[key] : []))
    .filter(isObject)
    .flatMap((branch) => [
      ...(isObject(branch.properties) ? Object.keys(branch.properties) : []),
      ...requiredFields(branch),
      ...branchFields(branch),
    ]);
}

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

/** Asked before "Quitar validación": a plain Cancelar / Eliminar, no word to type. */
export const removeValidationRequest = (where: TargetWhere): ConfirmRequest => ({
  title: "Quitar validación",
  message: `Se quita la validación de “${where.coll}”: deja de validar los documentos y su esquema se pierde.`,
  confirmLabel: "Eliminar",
  where,
});
