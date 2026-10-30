import { describe, expect, it } from "vitest";
import { formatScript } from "./formatScript";

describe("formatScript", () => {
  it("indents nested objects and statements", () => {
    expect(formatScript("db.x.find({a:{$gt:1}}).forEach(function(d){print(d.a)})")).toBe(
      "db.x.find({\n  a: {\n    $gt: 1\n  }\n}).forEach(function(d) {\n  print(d.a)\n})",
    );
  });

  it("keeps shell commands on their own lines", () => {
    expect(formatScript("use test\nshow collections")).toBe("use test\nshow collections");
  });
});
