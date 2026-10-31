import { describe, expect, it } from "vitest";
import { NO_PICK, pickAll, pickDocument, pickModeOf, pickedDocuments } from "./documentPick";

const indexes = (pick: { picked: ReadonlySet<number> }) => [...pick.picked].sort((a, b) => a - b);

describe("pickDocument", () => {
  it("a plain click picks only that document", () => {
    const pick = pickDocument(pickDocument(NO_PICK, 2, "only"), 5, "only");
    expect(indexes(pick)).toEqual([5]);
  });

  it("Ctrl+click adds and removes one document", () => {
    let pick = pickDocument(NO_PICK, 1, "only");
    pick = pickDocument(pick, 4, "toggle");
    expect(indexes(pick)).toEqual([1, 4]);
    expect(indexes(pickDocument(pick, 1, "toggle"))).toEqual([4]);
  });

  it("Shift+click picks the range from the anchor, both ways, and can be stretched again", () => {
    const start = pickDocument(NO_PICK, 4, "only");
    expect(indexes(pickDocument(start, 7, "range"))).toEqual([4, 5, 6, 7]);
    const up = pickDocument(pickDocument(start, 7, "range"), 2, "range");
    expect(indexes(up)).toEqual([2, 3, 4]);
  });

  it("Shift+click with nothing picked picks just that document", () => {
    expect(indexes(pickDocument(NO_PICK, 3, "range"))).toEqual([3]);
  });
});

describe("pickModeOf", () => {
  it("reads Shift before Ctrl or Cmd", () => {
    expect(pickModeOf({ ctrlKey: false, metaKey: false, shiftKey: false })).toBe("only");
    expect(pickModeOf({ ctrlKey: true, metaKey: false, shiftKey: false })).toBe("toggle");
    expect(pickModeOf({ ctrlKey: false, metaKey: true, shiftKey: false })).toBe("toggle");
    expect(pickModeOf({ ctrlKey: true, metaKey: false, shiftKey: true })).toBe("range");
  });
});

describe("pickAll and pickedDocuments", () => {
  it("picks the whole page and returns the documents in page order", () => {
    const docs = ["a", "b", "c", "d"];
    expect(pickedDocuments(pickAll(docs.length), docs)).toEqual(docs);
    const pick = pickDocument(pickDocument(NO_PICK, 3, "only"), 0, "toggle");
    expect(pickedDocuments(pick, docs)).toEqual(["a", "d"]);
  });
});
