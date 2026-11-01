import { describe, expect, it } from "vitest";
import { consoleEntries, resultConsoleEntries, WRITE_RESULT_LABEL } from "./consoleEntry";
import type { ScriptOutcome, ScriptResult } from "./outcome";
import { resultEntries } from "./resultLayout";

const doc = { _id: { $oid: "5f1d7a3c9b1e8a0012345678" }, name: "Lima" };

const outcomeOf = (results: ScriptResult[], error: ScriptOutcome["error"] = null): ScriptOutcome => ({
  results,
  error,
  truncated: false,
  elapsedMs: 1,
  queryMs: null,
});

const at = (line: number) => ({ line, source: `s${line}` });

const kindsOf = (results: ScriptResult[]) => consoleEntries(outcomeOf(results)).map((e) => e.kind);

describe("consoleEntries", () => {
  it("shows a cursor as a cursor whatever it holds: one document, many or none", () => {
    const cursor = (documents: unknown[]): ScriptResult => ({ ...at(1), kind: "cursor", ns: "t.c", cursorId: null, documents: documents as never, exhausted: true });
    expect(kindsOf([cursor([doc]), cursor([doc, doc]), cursor([])])).toEqual(["cursor", "cursor", "cursor"]);
  });

  it("an array value is an array even with a single document (toArray, distinct)", () => {
    const entries = consoleEntries(outcomeOf([{ ...at(2), kind: "value", value: [doc] }]));
    expect(entries).toEqual([{ kind: "array", line: 2, index: 0, value: [doc] }]);
  });

  it("only a confirmed document is an object (findOne, runCommand)", () => {
    expect(consoleEntries(outcomeOf([{ ...at(3), kind: "value", value: doc }]))).toEqual([
      { kind: "object", line: 3, index: 0, value: doc, label: null },
    ]);
  });

  it("labels write results as WriteResult", () => {
    const [entry] = consoleEntries(outcomeOf([{ ...at(4), kind: "write", value: { acknowledged: true } }]));
    expect(entry).toMatchObject({ kind: "object", label: WRITE_RESULT_LABEL });
  });

  it("keeps EJSON wrappers, null, numbers and strings as scalars", () => {
    const values = [{ $oid: "5f1d7a3c9b1e8a0012345678" }, { $date: { $numberLong: "0" } }, null, { $numberDouble: "120.0" }, 120, "db"];
    expect(kindsOf(values.map((value, i) => ({ ...at(i + 1), kind: "value", value })))).toEqual(values.map(() => "scalar"));
  });

  it("keeps prints with their line and puts the error last", () => {
    const error = { kind: "script" as const, message: "boom", line: 7, column: 1 };
    const entries = consoleEntries(outcomeOf([{ ...at(5), kind: "print", text: "hola" }], error));
    expect(entries).toEqual([
      { kind: "print", line: 5, index: 0, text: "hola", values: null, json: false },
      { kind: "error", line: 7, error },
    ]);
  });

  it("keeps the printed values when print got something other than text", () => {
    const values = ["doc:", { a: 1 }, [2]];
    const [entry] = consoleEntries(outcomeOf([{ ...at(2), kind: "print", text: "doc: …", values }]));
    expect(entry).toEqual({ kind: "print", line: 2, index: 0, text: "doc: …", values, json: false });
  });

  it("an error without a line (timeout, cancelled) has none", () => {
    const error = { kind: "timeout" as const, message: "t", line: null, column: null };
    expect(consoleEntries(outcomeOf([], error))).toEqual([{ kind: "error", line: null, error }]);
  });
});

describe("resultConsoleEntries", () => {
  const results: ScriptResult[] = [
    { ...at(1), kind: "print", text: "hola" },
    { ...at(1), kind: "value", value: doc },
    { ...at(2), kind: "value", value: 5 },
  ];
  const outcome = outcomeOf(results, { message: "boom", line: 3 } as never);

  it("keeps everything its statement printed and returned, prints included", () => {
    const [first] = resultEntries(outcome);
    expect(resultConsoleEntries(outcome, first).map((e) => e.kind)).toEqual(["print", "object"]);
  });

  it("keeps only the error for the error's result", () => {
    const entries = resultEntries(outcome);
    expect(resultConsoleEntries(outcome, entries[entries.length - 1]).map((e) => e.kind)).toEqual(["error"]);
  });
});
