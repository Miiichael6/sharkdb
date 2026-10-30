import { describe, expect, it } from "vitest";
import { targetOfNamespace } from "./documentTarget";

describe("targetOfNamespace", () => {
  it("splits at the first dot, keeping dots in the collection name", () => {
    expect(targetOfNamespace("s1", "shop.orders")).toEqual({ sid: "s1", db: "shop", coll: "orders" });
    expect(targetOfNamespace("s1", "shop.system.views")).toEqual({ sid: "s1", db: "shop", coll: "system.views" });
  });

  it("rejects namespaces without both parts", () => {
    expect(targetOfNamespace("s1", "shop")).toBeNull();
    expect(targetOfNamespace("s1", ".orders")).toBeNull();
    expect(targetOfNamespace("s1", "shop.")).toBeNull();
  });
});
