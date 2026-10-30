import { describe, expect, it } from "vitest";
import { statusLabel, statusLocation } from "./statusLabel";

describe("statusLabel", () => {
  const base = { tag: "production" as const, version: "7.0.2", connection: "Clientes" };

  it("shows the environment, version and full location", () => {
    expect(statusLabel({ ...base, db: "shop", coll: "orders" })).toBe("PRODUCTION | MongoDB 7.0.2 : Clientes : shop : orders");
  });

  it("leaves out the database and collection when there are none", () => {
    expect(statusLocation(base)).toBe("MongoDB 7.0.2 : Clientes");
    expect(statusLocation({ ...base, db: "shop" })).toBe("MongoDB 7.0.2 : Clientes : shop");
  });
});
