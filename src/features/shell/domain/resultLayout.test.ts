import { describe, expect, it } from "vitest";
import type { ScriptError, ScriptOutcome, ScriptResult } from "./outcome";
import { resultEntries, resultLayout, resultTitle, type ResultEntry } from "./resultLayout";

const value = (line: number, source = `x${line}`): ScriptResult => ({ kind: "value", value: line, line, source, elapsedMs: 1 });
const print = (line: number, text: string): ScriptResult => ({ kind: "print", text, line, source: `x${line}`, elapsedMs: 1 });
const error: ScriptError = { kind: "script", message: "ReferenceError: y is not defined", line: 3, column: 1 };
const outcome = (results: ScriptResult[], err: ScriptError | null = null): ScriptOutcome => ({ results, error: err, truncated: false, elapsedMs: 1, queryMs: null });
const line = (text: string) => ({ text, json: false });
const statement = (source: string, line = 3): ResultEntry => ({ kind: "statement", line, source, elapsedMs: 1, prints: [], value: null });
const printed = (values: unknown[], line = 1): ScriptResult => ({ kind: "print", text: "…", values, line, source: `x${line}`, elapsedMs: 1 });

describe("resultEntries", () => {
  it("groups each statement's prints, and drops them when it returns a value, as Robo 3T does", () => {
    const entries = resultEntries(outcome([print(1, "a"), printed([{ a: 1 }]), value(1), print(2, "c"), value(3)]));
    expect(entries).toEqual([
      { kind: "statement", line: 1, source: "x1", elapsedMs: 1, prints: [], value: { result: value(1), index: 2 } },
      { kind: "statement", line: 2, source: "x2", elapsedMs: 1, prints: [line("c")], value: null },
      { kind: "statement", line: 3, source: "x3", elapsedMs: 1, prints: [], value: { result: value(3), index: 4 } },
    ]);
  });

  it("shows only the last print when it prints documents, in the tree like a returned value", () => {
    const doc = { a: 1 };
    const entries = resultEntries(outcome([print(1, "a"), printed([{ b: 2 }]), printed([doc, [1]])]));
    expect(entries).toEqual([{ kind: "statement", line: 1, source: "x1", elapsedMs: 1, prints: [], value: { result: { kind: "value", value: [doc, [1]], line: 1, source: "x1", elapsedMs: 1 }, index: 2 } }]);
  });

  it("shows everything printed as text when the last print is text", () => {
    const entries = resultEntries(outcome([printed([{ b: 2 }]), print(1, "a"), printed(["doc:", { b: 2 }])]));
    expect(entries).toEqual([{ kind: "statement", line: 1, source: "x1", elapsedMs: 1, prints: [line("…"), line("a"), line("…")], value: null }]);
  });

  it("keeps two equal statements on the same line apart", () => {
    expect(resultEntries(outcome([value(1, "1;"), value(1, "1;")]))).toHaveLength(2);
  });

  it("puts the error last, after the statements that ran", () => {
    const entries = resultEntries(outcome([value(1), value(2)], error));
    expect(entries.map((e) => e.kind)).toEqual(["statement", "statement", "error"]);
  });
});

describe("resultLayout", () => {
  const entries = (n: number) => Array.from({ length: n }, (_, i) => statement("x", i + 1));

  it("shows nothing or one result as before", () => {
    expect(resultLayout(entries(0))).toBe("single");
    expect(resultLayout(entries(1))).toBe("single");
  });

  it("stacks two results and puts three or more in tabs", () => {
    expect(resultLayout(entries(2))).toBe("stacked");
    expect(resultLayout(entries(3))).toBe("tabs");
  });
});

describe("resultTitle", () => {
  it("drops db.getCollection and the call's arguments", () => {
    expect(resultTitle(statement("db.getCollection('Liquidadas_Claro').find({})"))).toBe("L3 · Liquidadas_Claro.find");
    expect(resultTitle(statement('db.getCollection("a.b").find({}).limit(3)'))).toBe("L3 · a.b.find");
  });

  it("drops the db prefix", () => {
    expect(resultTitle(statement("db.users.findOne({ _id: 1 });", 7))).toBe("L7 · users.findOne");
  });

  it("cuts a long statement", () => {
    const title = resultTitle(statement("unaVariableConUnNombreMuyLargoQueNoCabeEnElTitulo + otraVariable"));
    expect(title).toBe("L3 · unaVariableConUnNombreMuyLargoQueNoCabeE…");
  });

  it("names the error by its line", () => {
    expect(resultTitle({ kind: "error", error })).toBe("L3 · Error");
    expect(resultTitle({ kind: "error", error: { ...error, line: null } })).toBe("Error");
  });
});
