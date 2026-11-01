import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SIZE, firstPage, grownPage, nextPage, previousPage, rangeLabel, withLimit, withSkip } from "./paging";

describe("paging", () => {
  it("starts at 0 with Robo 3T's page size", () => {
    expect(firstPage()).toEqual({ skip: 0, limit: DEFAULT_PAGE_SIZE });
  });

  it("moves a page forward and back without going below 0", () => {
    expect(nextPage({ skip: 0, limit: 50 })).toEqual({ skip: 50, limit: 50 });
    expect(previousPage({ skip: 50, limit: 50 })).toEqual({ skip: 0, limit: 50 });
    expect(previousPage({ skip: 20, limit: 50 })).toEqual({ skip: 0, limit: 50 });
  });

  it("sanitises typed skip and limit", () => {
    expect(withSkip(firstPage(), -3).skip).toBe(0);
    expect(withSkip(firstPage(), 12.7).skip).toBe(12);
    expect(withLimit(firstPage(), 0).limit).toBe(1);
    expect(withLimit(firstPage(), NaN).limit).toBe(1);
  });

  it("labels the documents on screen", () => {
    expect(rangeLabel({ skip: 50, limit: 50 }, 50)).toBe("51 – 100");
    expect(rangeLabel({ skip: 100, limit: 50 }, 7)).toBe("101 – 107");
    expect(rangeLabel(firstPage(), 0)).toBe("0");
  });

  it("grows the console's page by one more page from the first document", () => {
    expect(grownPage(firstPage())).toEqual({ skip: 0, limit: DEFAULT_PAGE_SIZE * 2 });
    expect(grownPage({ skip: 0, limit: 120 })).toEqual({ skip: 0, limit: 120 + DEFAULT_PAGE_SIZE });
  });
});
