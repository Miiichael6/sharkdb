import { describe, expect, it } from "vitest";
import { statusLabel, statusLocation } from "./statusLabel";

describe("statusLabel", () => {
  const base = { tag: "production" as const, version: "7.0.2", connection: "Clientes" };

  it("shows the environment, version and full location", () => {
    expect(statusLabel({ ...base, db: "shop", coll: "orders" })).toBe("PRODUCTION | MongoDB 7.0.2 : Clientes : shop : orders");
  });

  it("says when the session is read-only", () => {
    expect(statusLabel({ ...base, safeMode: true })).toBe("PRODUCTION | SOLO LECTURA | MongoDB 7.0.2 : Clientes");
  });

  it("leaves out the database and collection when there are none", () => {
    expect(statusLocation(base)).toBe("MongoDB 7.0.2 : Clientes");
    expect(statusLocation({ ...base, db: "shop" })).toBe("MongoDB 7.0.2 : Clientes : shop");
  });
});
