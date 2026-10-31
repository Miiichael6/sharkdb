import { describe, expect, it } from "vitest";
import {
  collModCommand,
  EMPTY_RULE,
  readValidation,
  removeValidationCommand,
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

  it("keeps a script's validator whole when it mixes $jsonSchema and query operators", () => {
    const validator = { $jsonSchema: genero, Estado: { $exists: true } };
    const v = readValidation({ validator });
    expect(v.rule).toEqual(validator);
    expect(v.wholeValidator).toBe(true);
    expect(readValidation({ validator: { Estado: { $exists: true } } })).toMatchObject({ wholeValidator: true, extraFields: "permitir" });
  });
});

describe("withExtraFields", () => {
  it('"rechazar" closes the root and the nested objects, and admits _id at the root', () => {
    const closed = withExtraFields(genero, "rechazar");
    expect(closed.additionalProperties).toBe(false);
    expect(Object.keys(closed.properties)[0]).toBe("_id");
    expect(closed.properties.Detalle.additionalProperties).toBe(false);
    expect(closed.properties.Detalle.properties).toEqual({ type: { bsonType: "string" } });
    expect(closed.properties.Tags.items.additionalProperties).toBe(false);
    expect(closed.properties.Nombre).toEqual({ bsonType: "string" });
  });

  it("keeps an _id the schema already declares", () => {
    const schema = { properties: { _id: { bsonType: "objectId" }, a: {} } };
    expect(withExtraFields(schema, "rechazar").properties._id).toEqual({ bsonType: "objectId" });
  });

  it('"permitir" leaves an open schema as it is and opens a closed one', () => {
    expect(withExtraFields(genero, "permitir")).toEqual(genero);
    expect(withExtraFields(withExtraFields(genero, "rechazar"), "permitir").properties.Detalle).toEqual(genero.properties.Detalle);
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
});

describe("collModCommand", () => {
  it("sends the validator, level and action, with collMod first", () => {
    for (const level of ["moderate", "strict"] as const) {
      for (const action of ["error", "warn"] as const) {
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
