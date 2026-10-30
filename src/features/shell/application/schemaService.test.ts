import { describe, expect, it } from "vitest";
import type { SchemaSource } from "./ports";
import { createSchemaService, FIELD_SAMPLE_SIZE, SCHEMA_TTL_MS } from "./schemaService";

function fakeSource() {
  const calls: string[] = [];
  const source: SchemaSource = {
    async listCollections(sid, db) {
      calls.push(`list ${sid} ${db}`);
      if (db === "denied") throw new Error("not authorized");
      return ["a", "b"];
    },
    async sampleDocuments(_sid, db, coll, limit) {
      calls.push(`sample ${db}.${coll} ${limit}`);
      return [{ name: "x", addr: { city: "y" } }];
    },
  };
  return { source, calls };
}

describe("schemaService", () => {
  it("caches collection names until the TTL expires", async () => {
    const { source, calls } = fakeSource();
    let clock = 0;
    const schema = createSchemaService(source, () => clock);
    expect(await schema.collections("s1", "test")).toEqual(["a", "b"]);
    clock = SCHEMA_TTL_MS - 1;
    await schema.collections("s1", "test");
    clock = SCHEMA_TTL_MS;
    await schema.collections("s1", "test");
    expect(calls).toEqual(["list s1 test", "list s1 test"]);
  });

  it("turns sampled documents into field paths", async () => {
    const { source, calls } = fakeSource();
    expect(await createSchemaService(source).fields("s1", "test", "users")).toEqual(["addr", "addr.city", "name"]);
    expect(calls).toEqual([`sample test.users ${FIELD_SAMPLE_SIZE}`]);
  });

  it("offers nothing when the source fails", async () => {
    const { source } = fakeSource();
    expect(await createSchemaService(source).collections("s1", "denied")).toEqual([]);
  });
});
