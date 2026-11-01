import { describe, expect, it } from "vitest";
import { elapsedText, missingForPage, pageOf, READ_ONLY_TEXT, scriptErrorText, timingText } from "./outcome";

const docs = (n: number) => Array.from({ length: n }, (_, i) => ({ _id: i }));

describe("missingForPage", () => {
  it("counts what is left to read for the page", () => {
    expect(missingForPage(50, 50, 50)).toBe(50);
    expect(missingForPage(60, 50, 50)).toBe(40);
  });

  it("is zero when the page is already read", () => {
    expect(missingForPage(100, 0, 50)).toBe(0);
  });
});

describe("pageOf", () => {
  it("slices the page out of the read documents", () => {
    const page = pageOf(docs(120), 50, 50, true);
    expect(page.documents.map((d) => d._id)).toEqual(Array.from({ length: 50 }, (_, i) => i + 50));
    expect(page.hasMore).toBe(true);
  });

  it("has no more after the last page of an exhausted cursor", () => {
    expect(pageOf(docs(120), 100, 50, true)).toEqual({ documents: docs(120).slice(100), hasMore: false });
  });

  it("has more while the cursor is still open", () => {
    expect(pageOf(docs(50), 0, 50, false).hasMore).toBe(true);
  });
});

describe("scriptErrorText", () => {
  it("says where the error happened when known", () => {
    expect(scriptErrorText({ kind: "script", message: "x is not defined", line: 3, column: 5 })).toBe(
      "Error (línea 3, columna 5): x is not defined",
    );
    expect(scriptErrorText({ kind: "cancelled", message: "interrumpido", line: null, column: null })).toBe("Detenido: interrumpido");
  });

  it("explains a write stopped by safe mode instead of showing the backend's message", () => {
    expect(scriptErrorText({ kind: "readOnly", message: "Safe mode activo: solo lectura", line: 299, column: 93 })).toBe(
      `Solo lectura (línea 299): ${READ_ONLY_TEXT}`,
    );
  });
});

describe("elapsedText", () => {
  it("shows the time in seconds with millisecond precision", () => {
    expect(elapsedText(12)).toBe("0.012 s");
    expect(elapsedText(2350)).toBe("2.350 s");
    expect(elapsedText(0)).toBe("0.000 s");
  });
});

describe("timingText", () => {
  it("splits query and load time when the script queried the server", () => {
    expect(timingText({ elapsedMs: 76, queryMs: 6 })).toBe("0.006 s · carga 0.070 s");
  });

  it("shows only the total when there was no query", () => {
    expect(timingText({ elapsedMs: 12, queryMs: null })).toBe("0.012 s");
  });
});
