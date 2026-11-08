import { describe, expect, it, vi } from "vitest";
import type { McpActivity } from "../domain/activity";
import type { ChatEvent } from "../domain/chat";
import { createClaudeService } from "./claudeService";
import type { ClaudeGateway, ExposurePrefs } from "./ports";

function setup(overrides: Partial<ClaudeGateway> = {}, hidden: string[] = []) {
  let emitChat: (event: ChatEvent) => void = () => {};
  let emitActivity: (entry: McpActivity) => void = () => {};
  const gateway: ClaudeGateway = {
    hasToken: vi.fn(async () => true),
    saveToken: vi.fn(async () => {}),
    forgetToken: vi.fn(async () => {}),
    send: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    newConversation: vi.fn(async () => {}),
    setExposed: vi.fn(async () => {}),
    onChatEvent: async (listener) => {
      emitChat = listener;
      return () => {};
    },
    onActivity: async (listener) => {
      emitActivity = listener;
      return () => {};
    },
    ...overrides,
  };
  const prefs: ExposurePrefs = { load: () => hidden, save: vi.fn() };
  const service = createClaudeService(gateway, prefs);
  return { service, gateway, prefs, emitChat: (e: ChatEvent) => emitChat(e), emitActivity: (a: McpActivity) => emitActivity(a) };
}

const open = [
  { id: "a", name: "Local", safeMode: false },
  { id: "b", name: "Prod", safeMode: true },
];

describe("claudeService", () => {
  it("starts once: listens and checks the token", async () => {
    const { service, gateway } = setup({ hasToken: vi.fn(async () => false) });
    expect(service.current().token).toBe("checking");
    await service.start();
    await service.start();
    expect(gateway.hasToken).toHaveBeenCalledTimes(1);
    expect(service.current().token).toBe("missing");
  });

  it("sends a message and builds the answer from the events", async () => {
    const { service, gateway, emitChat } = setup();
    await service.start();
    await service.send("  hola ");
    expect(gateway.send).toHaveBeenCalledWith("hola");
    expect(service.current().chat.busy).toBe(true);
    await service.send("otra");
    expect(gateway.send).toHaveBeenCalledTimes(1);
    emitChat({ kind: "text", text: "Hola" });
    emitChat({ kind: "turnEnd", error: null, costUsd: 0.01 });
    expect(service.current().chat.items.map((i) => i.kind)).toEqual(["user", "assistant"]);
    expect(service.current().chat.busy).toBe(false);
  });

  it("a failed send shows why and frees the input", async () => {
    const { service } = setup({ send: vi.fn(async () => Promise.reject("Claude Code no está instalado")) });
    await service.send("hola");
    expect(service.current().chat.busy).toBe(false);
    expect(service.current().chat.items.slice(-1)[0]).toMatchObject({ kind: "notice", text: "Claude Code no está instalado" });
  });

  it("exposes the open connections but the unchecked ones, telling the server only on changes", () => {
    const { service, gateway, prefs } = setup({}, ["b"]);
    service.setOpenConnections(open);
    service.setOpenConnections([...open]);
    expect(gateway.setExposed).toHaveBeenCalledTimes(1);
    expect(gateway.setExposed).toHaveBeenLastCalledWith([{ id: "a", name: "Local" }]);
    service.setExposed("b", true);
    expect(prefs.save).toHaveBeenLastCalledWith([]);
    expect(gateway.setExposed).toHaveBeenLastCalledWith([
      { id: "a", name: "Local" },
      { id: "b", name: "Prod" },
    ]);
    expect(service.current().connections.every((c) => c.exposed)).toBe(true);
  });

  it("records the MCP activity and clears the ended calls", async () => {
    const { service, emitActivity } = setup();
    await service.start();
    const call = { id: 1, tool: "find", arguments: {}, startedAt: 0, status: "running", durationMs: null, result: null } as const;
    emitActivity(call);
    emitActivity({ ...call, id: 2, status: "ok" });
    service.clearActivity();
    expect(service.current().activity.map((a) => a.id)).toEqual([1]);
  });

  it("forgetting the token ends the conversation", async () => {
    const { service } = setup();
    await service.send("hola");
    await service.forgetToken();
    expect(service.current().token).toBe("missing");
    expect(service.current().chat.items).toEqual([]);
  });
});
