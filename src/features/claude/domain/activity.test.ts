import { describe, expect, it } from "vitest";
import { ALL_ACTIVITY, filterActivity, MAX_ACTIVITY, recordActivity, type McpActivity } from "./activity";

const call = (id: number, over: Partial<McpActivity> = {}): McpActivity => ({
  id,
  tool: "find",
  arguments: { connection: "local", collection: "orders" },
  startedAt: 1000,
  status: "running",
  durationMs: null,
  result: null,
  ...over,
});

describe("activity", () => {
  it("adds new calls first and updates them when they end", () => {
    const list = recordActivity(recordActivity([], call(1)), call(2));
    expect(list.map((a) => a.id)).toEqual([2, 1]);
    const ended = recordActivity(list, call(1, { status: "ok", durationMs: 12, result: "[]" }));
    expect(ended.map((a) => a.id)).toEqual([2, 1]);
    expect(ended[1]).toMatchObject({ status: "ok", durationMs: 12 });
  });

  it("keeps only the newest calls", () => {
    let list: McpActivity[] = [];
    for (let id = 1; id <= MAX_ACTIVITY + 5; id++) list = recordActivity(list, call(id));
    expect(list).toHaveLength(MAX_ACTIVITY);
    expect(list[0].id).toBe(MAX_ACTIVITY + 5);
  });

  it("filters by status and by tool or arguments", () => {
    const list = [call(1, { status: "error", tool: "insert" }), call(2, { status: "ok", arguments: { collection: "users" } })];
    expect(filterActivity(list, ALL_ACTIVITY)).toHaveLength(2);
    expect(filterActivity(list, { text: "", status: "error" }).map((a) => a.id)).toEqual([1]);
    expect(filterActivity(list, { text: "USERS", status: "all" }).map((a) => a.id)).toEqual([2]);
    expect(filterActivity(list, { text: "insert", status: "ok" })).toEqual([]);
  });
});
