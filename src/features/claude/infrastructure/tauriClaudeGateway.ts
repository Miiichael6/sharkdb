import { listen } from "@tauri-apps/api/event";
import { call } from "../../../shared/infrastructure/tauri";
import type { ClaudeGateway } from "../application/ports";
import type { McpActivity } from "../domain/activity";
import type { ChatEvent } from "../domain/chat";

const CHAT_EVENT = "claude://event";
const ACTIVITY_EVENT = "mcp://activity";

export const tauriClaudeGateway: ClaudeGateway = {
  hasToken: () => call<boolean>("claude_has_token"),
  saveToken: (token) => call("claude_save_token", { token }),
  forgetToken: () => call("claude_forget_token"),
  send: (text) => call("claude_send", { text }),
  stop: () => call("claude_stop"),
  newConversation: () => call("claude_new_conversation"),
  setExposed: (connections) => call("mcp_set_exposed", { connections }),
  onChatEvent: (listener) => listen<ChatEvent>(CHAT_EVENT, (e) => listener(e.payload)),
  onActivity: (listener) => listen<McpActivity>(ACTIVITY_EVENT, (e) => listener(e.payload)),
};
