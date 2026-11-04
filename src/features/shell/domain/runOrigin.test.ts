import { describe, expect, it } from "vitest";
import type { ScriptError, ScriptOutcome } from "./outcome";
import { atEditorLines, SCRIPT_START } from "./runOrigin";

const error = (line: number | null, column: number | null): ScriptError => ({ kind: "script", message: "boom", line, column });

const outcome = (err: ScriptError | null = null): ScriptOutcome => ({
  results: [
    { kind: "value", value: 1, line: 1, source: "1", elapsedMs: 1 },
    { kind: "print", text: "x", line: 3, source: "print('x')", elapsedMs: 1 },
  ],
  error: err,
  truncated: false,
  elapsedMs: 5,
  queryMs: null,
  db: null,
});

describe("atEditorLines", () => {
  it("leaves a whole-script run as is", () => {
    const run = outcome(error(2, 4));
    expect(atEditorLines(run, SCRIPT_START)).toBe(run);
  });

  it("moves results and error to the selection's lines", () => {
    const moved = atEditorLines(outcome(error(2, 4)), { line: 10, column: 0 });
    expect(moved.results.map((r) => r.line)).toEqual([10, 12]);
    expect(moved.error).toMatchObject({ line: 11, column: 4 });
  });

  it("adds the selection's column only to an error on its first line", () => {
    expect(atEditorLines(outcome(error(1, 3)), { line: 5, column: 8 }).error).toMatchObject({ line: 5, column: 11 });
    expect(atEditorLines(outcome(error(2, 3)), { line: 5, column: 8 }).error).toMatchObject({ line: 6, column: 3 });
  });

  it("keeps an error without position unplaced", () => {
    expect(atEditorLines(outcome(error(null, null)), { line: 7, column: 2 }).error).toMatchObject({ line: null, column: null });
  });
});
