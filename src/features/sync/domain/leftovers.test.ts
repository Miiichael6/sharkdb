import { describe, expect, it } from "vitest";
import { leftoversRequest } from "./leftovers";

const leftover = (n: number) => ({ db: "shop", collection: `orders.sharkdb-staging-${n}` });

describe("leftoversRequest", () => {
  it("names the server and each provisional collection", () => {
    const request = leftoversRequest("QA", [leftover(1)]);
    expect(request.message).toContain("En QA hay una copia temporal");
    expect(request.message).toContain("• shop.orders.sharkdb-staging-1");
    expect(request.confirmLabel).toBe("Borrar");
  });

  it("says the real collections are not touched", () => {
    const request = leftoversRequest("QA", [leftover(1), leftover(2)]);
    expect(request.message).toContain("no afecta a tus colecciones reales");
  });

  it("lists every one of them, however many", () => {
    const request = leftoversRequest("QA", Array.from({ length: 30 }, (_, i) => leftover(i)));
    expect(request.message).toContain("30 copias temporales");
    for (let i = 0; i < 30; i++) expect(request.message).toContain(`• shop.orders.sharkdb-staging-${i}`);
    expect(request.message).not.toContain("más");
  });
});
