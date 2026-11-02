import { describe, expect, it } from "vitest";
import {
  collModCommand,
  EMPTY_RULE,
  NO_FIELDS_TO_KEEP,
  readValidation,
  removeValidationCommand,
  removeValidationRequest,
  VALIDATION_LEVELS,
  validationActions,
  validatorFrom,
  withExtraFields,
} from "./validation";

const genero = {
  bsonType: "object",
  required: ["Nombre"],
  properties: {
    Nombre: { bsonType: "string" },
    Detalle: { bsonType: "object", properties: { type: { bsonType: "string" } } },
    Tags: { bsonType: "array", items: { bsonType: "object", properties: { Valor: { bsonType: "int" } } } },
  },
};

describe("readValidation", () => {
  it("without a validator: nothing to edit, MongoDB's defaults", () => {
    expect(readValidation({})).toEqual({
      rule: null,
      wholeValidator: false,
      level: "strict",
      action: "error",
      extraFields: "permitir",
    });
    expect(readValidation({ validator: {} }).rule).toBeNull();
    expect(readValidation(undefined).rule).toBeNull();
  });

  it("reads the $jsonSchema, the level and the action stored", () => {
    const v = readValidation({
      validator: { $jsonSchema: { ...genero, additionalProperties: false } },
      validationLevel: "moderate",
      validationAction: "warn",
    });
    expect(v.rule).toEqual({ ...genero, additionalProperties: false });
    expect(v).toMatchObject({ wholeValidator: false, level: "moderate", action: "warn", extraFields: "rechazar" });
  });

  it("level and action not stored count as strict and error", () => {
    expect(readValidation({ validator: { $jsonSchema: genero } })).toMatchObject({ level: "strict", action: "error" });
  });

  it('keeps level "off" and action "errorAndLog" instead of turning them into strict and error', () => {
    const v = readValidation({ validator: { $jsonSchema: genero }, validationLevel: "off", validationAction: "errorAndLog" });
    expect(v).toMatchObject({ level: "off", action: "errorAndLog" });
    expect(collModCommand("Genero", { $jsonSchema: genero }, v)).toMatchObject({
      validationLevel: "off",
      validationAction: "errorAndLog",
    });
  });

  it("values it doesn't know count as the defaults", () => {
    expect(readValidation({ validator: { $jsonSchema: genero }, validationLevel: "x", validationAction: 3 })).toMatchObject({
      level: "strict",
      action: "error",
    });
  });
});

describe("validation options", () => {
  it("offers every level, off included", () => {
    expect(VALIDATION_LEVELS).toEqual(["off", "moderate", "strict"]);
  });

  it("offers errorAndLog only when the collection already has it", () => {
    expect(validationActions("error")).toEqual(["error", "warn"]);
    expect(validationActions("warn")).toEqual(["error", "warn"]);
    expect(validationActions("errorAndLog")).toEqual(["error", "warn", "errorAndLog"]);
  });

  it("keeps a script's validator whole when it mixes $jsonSchema and query operators", () => {
    const validator = { $jsonSchema: genero, Estado: { $exists: true } };
    const v = readValidation({ validator });
    expect(v.rule).toEqual(validator);
    expect(v.wholeValidator).toBe(true);
    expect(readValidation({ validator: { Estado: { $exists: true } } })).toMatchObject({ wholeValidator: true, extraFields: "permitir" });
  });
});

describe("withExtraFields", () => {
  it('"rechazar" closes only the root and admits _id there', () => {
    const closed = withExtraFields(genero, "rechazar");
    expect(closed.additionalProperties).toBe(false);
    expect(Object.keys(closed.properties)[0]).toBe("_id");
    expect(closed.properties._id).toEqual({});
    expect(closed.properties.Detalle).toEqual(genero.properties.Detalle);
    expect(closed.properties.Tags).toEqual(genero.properties.Tags);
    expect(closed.properties.Nombre).toEqual({ bsonType: "string" });
  });

  it("keeps an _id the schema already declares", () => {
    const schema = { properties: { _id: { bsonType: "objectId" }, a: {} } };
    expect(withExtraFields(schema, "rechazar").properties._id).toEqual({ bsonType: "objectId" });
  });

  it('"rechazar" refuses a schema that names no field, instead of saving it open without saying so', () => {
    expect(() => withExtraFields({ bsonType: "object" }, "rechazar")).toThrow(NO_FIELDS_TO_KEEP);
    expect(() => withExtraFields({ bsonType: "object", additionalProperties: false }, "rechazar")).toThrow(NO_FIELDS_TO_KEEP);
    expect(() => withExtraFields({ properties: {}, required: [] }, "rechazar")).toThrow(NO_FIELDS_TO_KEEP);
  });

  it('"rechazar" allows the required fields that properties doesn\'t list', () => {
    const closed = withExtraFields({ required: ["email"], properties: { name: { bsonType: "string" } } }, "rechazar");
    expect(closed).toEqual({
      required: ["email"],
      properties: { _id: {}, email: {}, name: { bsonType: "string" } },
      additionalProperties: false,
    });
  });

  it('"rechazar" closes a schema that only has required', () => {
    expect(withExtraFields({ required: ["email", 3] }, "rechazar")).toEqual({
      required: ["email", 3],
      properties: { _id: {}, email: {} },
      additionalProperties: false,
    });
  });

  it('"rechazar" allows the required fields of anyOf/oneOf/allOf branches, not of a not branch', () => {
    const closed = withExtraFields(
      { properties: { a: {} }, anyOf: [{ required: ["b"] }, { oneOf: [{ required: ["c"] }] }], not: { required: ["d"] } },
      "rechazar",
    );
    expect(Object.keys(closed.properties)).toEqual(["_id", "b", "c", "a"]);
  });

  it('"rechazar" names at the root the fields of anyOf/oneOf/allOf branches, and leaves the branches open', () => {
    const anyOf = [{ properties: { a: { bsonType: "string" } } }, { properties: { b: { bsonType: "int" } } }];
    const closed = withExtraFields({ anyOf }, "rechazar");
    expect(closed).toEqual({ anyOf, properties: { _id: {}, a: {}, b: {} }, additionalProperties: false });

    const nested = withExtraFields(
      { properties: { a: { bsonType: "string" } }, allOf: [{ oneOf: [{ properties: { c: {} } }] }, { properties: { a: {} } }] },
      "rechazar",
    );
    expect(nested.properties).toEqual({ _id: {}, c: {}, a: { bsonType: "string" } });
    expect(nested.allOf).toEqual([{ oneOf: [{ properties: { c: {} } }] }, { properties: { a: {} } }]);
  });

  it('"rechazar" doesn\'t take the fields of a not branch as allowed', () => {
    const closed = withExtraFields({ properties: { a: {} }, not: { properties: { b: {} }, required: ["b"] } }, "rechazar");
    expect(Object.keys(closed.properties)).toEqual(["_id", "a"]);
  });

  it('"permitir" leaves an open schema as it is and opens a closed root', () => {
    expect(withExtraFields(genero, "permitir")).toEqual(genero);
    expect(withExtraFields({ ...genero, additionalProperties: false }, "permitir")).toEqual(genero);
  });

  it('"permitir" keeps additionalProperties: false the user wrote in nested objects and branches', () => {
    const schema = {
      additionalProperties: false,
      properties: { Detalle: { bsonType: "object", properties: { type: {} }, additionalProperties: false } },
      anyOf: [{ properties: { x: {} }, additionalProperties: false }],
    };
    const { additionalProperties: _, ...open } = schema;
    expect(withExtraFields(schema, "permitir")).toEqual(open);
  });

  it('"permitir" keeps a schema given as additionalProperties', () => {
    const schema = { properties: { a: {} }, additionalProperties: { bsonType: "string" } };
    expect(withExtraFields(schema, "permitir")).toEqual(schema);
  });
});

describe("validatorFrom", () => {
  it("wraps a schema in $jsonSchema", () => {
    expect(validatorFrom(genero, false, "permitir")).toEqual({ $jsonSchema: genero });
  });

  it("stores a whole validator as it is, applying the extra fields to its $jsonSchema", () => {
    const validator = { $jsonSchema: genero, Estado: { $exists: true } };
    const stored = validatorFrom(validator, true, "rechazar");
    expect(stored.Estado).toEqual({ $exists: true });
    expect(stored.$jsonSchema.additionalProperties).toBe(false);
    expect(validatorFrom({ Estado: { $exists: true } }, true, "rechazar")).toEqual({ Estado: { $exists: true } });
  });

  it("refuses an empty rule", () => {
    expect(() => validatorFrom({}, false, "permitir")).toThrow(EMPTY_RULE);
  });

  it('refuses "rechazar" on a schema without fields, so the window shows why it can\'t save', () => {
    expect(() => validatorFrom({ bsonType: "object" }, false, "rechazar")).toThrow(NO_FIELDS_TO_KEEP);
    expect(() => validatorFrom({ $jsonSchema: { bsonType: "object" }, x: { $exists: true } }, true, "rechazar")).toThrow(
      NO_FIELDS_TO_KEEP,
    );
    expect(validatorFrom({ bsonType: "object" }, false, "permitir")).toEqual({ $jsonSchema: { bsonType: "object" } });
  });
});

describe("collModCommand", () => {
  it("sends the validator, level and action, with collMod first", () => {
    for (const level of ["off", "moderate", "strict"] as const) {
      for (const action of ["error", "warn", "errorAndLog"] as const) {
        const command = collModCommand("Genero", { $jsonSchema: genero }, { level, action, extraFields: "permitir" });
        expect(Object.keys(command)[0]).toBe("collMod");
        expect(command).toEqual({
          collMod: "Genero",
          validator: { $jsonSchema: genero },
          validationLevel: level,
          validationAction: action,
        });
      }
    }
  });

  it("removing the validation sends an empty validator", () => {
    expect(removeValidationCommand("Genero")).toEqual({ collMod: "Genero", validator: {} });
  });
});

describe("removeValidationRequest", () => {
  it("asks Cancelar / Eliminar over the collection, without a word to type", () => {
    const where = { server: { name: "LOCAL", host: "localhost:27017" }, db: "shop", coll: "orders" };
    const request = removeValidationRequest(where);
    expect(request).toMatchObject({ title: "Quitar validación", confirmLabel: "Eliminar", where });
    expect(request.dismissLabel).toBeUndefined();
    expect(request.message).toContain("“orders”");
  });
});
