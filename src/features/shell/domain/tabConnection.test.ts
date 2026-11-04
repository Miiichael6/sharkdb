import { describe, expect, it } from "vitest";
import { newConnection, type MongoConnection } from "../../connections/domain/connection";
import { paneConnection, tabConnections, tabTooltip } from "./tabConnection";
import type { ShellTab } from "./tabs";

const conn = (id: string, extra: Partial<MongoConnection> = {}): MongoConnection => ({
  ...newConnection(),
  id,
  name: id.toUpperCase(),
  ...extra,
});

const pane = (sid: string, extra: Partial<ShellTab> = {}): ShellTab => ({
  id: `t-${sid}`,
  sid,
  serverLabel: `label-${sid}`,
  db: "test",
  title: "t",
  code: "",
  filePath: null,
  savedCode: "",
  runOnOpen: false,
  runRequest: 0,
  ...extra,
});

const a = conn("a", { color: "#111111" });
const b = conn("b", { color: "#222222", host: "other" });

describe("tabConnections", () => {
  it("gives a plain tab its connection's colour and name", () => {
    expect(tabConnections({ panes: [pane("a")] }, [a, b])).toEqual([{ id: "a", name: "A", color: "#111111", guard: null }]);
  });

  it("shows a split on one connection as a single dot", () => {
    expect(tabConnections({ panes: [pane("a"), pane("a")] }, [a, b])).toHaveLength(1);
  });

  it("shows a split on two connections as two dots, in pane order", () => {
    expect(tabConnections({ panes: [pane("b"), pane("a")] }, [a, b]).map((s) => s.color)).toEqual(["#222222", "#111111"]);
  });

  it("has no dot for a deleted connection", () => {
    expect(tabConnections({ panes: [pane("gone")] }, [a])).toEqual([]);
    expect(tabConnections({ panes: [pane("gone"), pane("a")] }, [a]).map((s) => s.id)).toEqual(["a"]);
  });
});

describe("paneConnection guard", () => {
  it("marks production, whatever its colour", () => {
    expect(paneConnection(pane("p"), [conn("p", { tag: "production" })])?.guard).toBe("production");
  });

  it("marks a protected connection", () => {
    expect(paneConnection(pane("p"), [conn("p", { protected: true })])?.guard).toBe("protected");
  });

  it("marks an unprotected entry for the same server as a protected one", () => {
    const twin = conn("twin", { protected: true });
    expect(paneConnection(pane("a"), [a, twin])?.guard).toBe("protected");
  });

  it("leaves other connections unmarked", () => {
    expect(paneConnection(pane("a"), [a, b])?.guard).toBeNull();
  });
});

describe("tabTooltip", () => {
  it("names the connection and its environment, per pane", () => {
    const prod = conn("p", { tag: "production", host: "prod" });
    expect(tabTooltip({ panes: [pane("a"), pane("p", { db: "sales" })] }, [a, prod])).toBe("A · test\nP (producción) · sales");
  });

  it("adds the script file and falls back to the opening label when the connection is gone", () => {
    expect(tabTooltip({ panes: [pane("gone", { filePath: "C:/q.js" })] }, [])).toBe("label-gone · test\nC:/q.js");
  });
});
