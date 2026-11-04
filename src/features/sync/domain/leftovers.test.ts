import { describe, expect, it } from "vitest";
import { leftoversRequest } from "./leftovers";

const leftover = (n: number) => ({ db: "shop", collection: `orders.sharkdb-staging-${n}` });

describe("leftoversRequest", () => {
  it("names the server and each provisional collection", () => {
    const request = leftoversRequest("QA", [leftover(1)]);
    expect(request.message).toContain("En QA hay una colección provisional");
    expect(request.message).toContain("• shop.orders.sharkdb-staging-1");
    expect(request.confirmLabel).toBe("Borrar");
  });

  it("names only the first ones and counts the rest", () => {
    const request = leftoversRequest("QA", Array.from({ length: 10 }, (_, i) => leftover(i)));
    expect(request.message).toContain("10 colecciones provisionales");
    expect(request.message).toContain("sharkdb-staging-7");
    expect(request.message).not.toContain("sharkdb-staging-8");
    expect(request.message).toContain("… y 2 más");
  });
});
