import { describe, expect, it } from "vitest";
import { applyEvent, EMPTY_CHAT, sendFailed, STOPPED_NOTICE, userSent, type ChatEvent, type ChatState } from "./chat";

const play = (events: ChatEvent[], from: ChatState = userSent(EMPTY_CHAT, "hola")) => events.reduce(applyEvent, from);

describe("chat", () => {
  it("a sent message starts the turn", () => {
    const state = userSent(EMPTY_CHAT, "hola");
    expect(state.busy).toBe(true);
    expect(state.items).toEqual([{ kind: "user", text: "hola" }]);
  });

  it("text streams in deltas and the whole block replaces them", () => {
    const streaming = play([
      { kind: "textDelta", text: "Ho" },
      { kind: "textDelta", text: "la" },
    ]);
    expect(streaming.items[1]).toEqual({ kind: "assistant", text: "Hola", streaming: true });
    const done = applyEvent(streaming, { kind: "text", text: "Hola." });
    expect(done.items).toHaveLength(2);
    expect(done.items[1]).toEqual({ kind: "assistant", text: "Hola.", streaming: false });
    expect(applyEvent(done, { kind: "textDelta", text: "Otra" }).items).toHaveLength(3);
  });

  it("a tool call waits for its result by id", () => {
    const state = play([
      { kind: "toolUse", id: "t1", name: "find", input: { collection: "orders" } },
      { kind: "toolUse", id: "t2", name: "count", input: {} },
      { kind: "toolResult", id: "t1", isError: false, text: "[]" },
    ]);
    expect(state.items[1]).toMatchObject({ kind: "tool", id: "t1", status: "ok", result: "[]" });
    expect(state.items[2]).toMatchObject({ kind: "tool", id: "t2", status: "running" });
    const failed = applyEvent(state, { kind: "toolResult", id: "t2", isError: true, text: "Safe mode" });
    expect(failed.items[2]).toMatchObject({ status: "error", result: "Safe mode" });
  });

  it("the end of the turn frees the input, adds the cost and shows an error", () => {
    const ok = play([
      { kind: "textDelta", text: "Hola" },
      { kind: "turnEnd", error: null, costUsd: 0.02 },
    ]);
    expect(ok.busy).toBe(false);
    expect(ok.costUsd).toBeCloseTo(0.02);
    expect(ok.items[1]).toMatchObject({ streaming: false });
    const failed = play([{ kind: "turnEnd", error: "Invalid API key", costUsd: null }], ok);
    expect(failed.costUsd).toBeCloseTo(0.02);
    expect(failed.items.slice(-1)[0]).toEqual({ kind: "notice", tone: "error", text: "Invalid API key" });
  });

  it("stopping leaves the pending calls as stopped", () => {
    const state = play([{ kind: "toolUse", id: "t1", name: "find", input: {} }, { kind: "stopped" }]);
    expect(state.busy).toBe(false);
    expect(state.items[1]).toMatchObject({ status: "stopped" });
    expect(state.items.slice(-1)[0]).toEqual({ kind: "notice", tone: "info", text: STOPPED_NOTICE });
  });

  it("an exit or a failed send end the turn with the reason", () => {
    expect(play([{ kind: "exited", reason: "boom" }]).items.slice(-1)[0]).toEqual({ kind: "notice", tone: "error", text: "boom" });
    const failed = sendFailed(userSent(EMPTY_CHAT, "hola"), "Sin token");
    expect(failed.busy).toBe(false);
    expect(failed.items.slice(-1)[0]).toMatchObject({ tone: "error", text: "Sin token" });
  });

  it("ready tells the model", () => {
    expect(play([{ kind: "ready", model: "claude-opus-5-5" }]).model).toBe("claude-opus-5-5");
  });
});
