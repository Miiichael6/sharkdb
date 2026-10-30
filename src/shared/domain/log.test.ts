import { describe, expect, it } from "vitest";
import { appendLog, logTime } from "./log";

const entry = (text: string) => ({ level: "info" as const, at: 0, text });

describe("log", () => {
  it("numbers entries and keeps the newest past the limit", () => {
    let log = appendLog([], entry("a"), 2);
    log = appendLog(log, entry("b"), 2);
    log = appendLog(log, entry("c"), 2);
    expect(log.map((e) => [e.id, e.text])).toEqual([
      [2, "b"],
      [3, "c"],
    ]);
  });

  it("formats the time as HH:MM:SS", () => {
    expect(logTime(new Date(2026, 0, 1, 9, 5, 3).getTime())).toBe("09:05:03");
  });
});
