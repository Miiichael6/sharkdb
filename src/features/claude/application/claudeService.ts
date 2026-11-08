import { errorMessage } from "../../../shared/errors";
import { recordActivity, type McpActivity } from "../domain/activity";
import { applyEvent, EMPTY_CHAT, sendFailed, userSent, type ChatState } from "../domain/chat";
import { exposable, exposedOf, sameExposure, withExposure, type ExposableConnection, type ExposedConnection, type OpenConnection } from "../domain/exposure";
import type { ClaudeGateway, ExposurePrefs } from "./ports";

export type TokenState = "checking" | "missing" | "saved";

export interface ClaudeState {
  token: TokenState;
  chat: ChatState;
  /** Newest first. */
  activity: McpActivity[];
  /** The open connections and whether Claude may use each one. */
  connections: ExposableConnection[];
}

export type ClaudeService = ReturnType<typeof createClaudeService>;

/**
 * The Claude tab: the setup token, the conversation, the MCP activity and the connections exposed
 * to the MCP server. It lives as long as the window, so the conversation survives closing the tab.
 */
export function createClaudeService(gateway: ClaudeGateway, prefs: ExposurePrefs) {
  let state: ClaudeState = { token: "checking", chat: EMPTY_CHAT, activity: [], connections: [] };
  let open: OpenConnection[] = [];
  let hidden = prefs.load();
  let told: ExposedConnection[] | null = null;
  let started = false;
  const listeners = new Set<(state: ClaudeState) => void>();

  const set = (patch: Partial<ClaudeState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener(state));
  };
  const setChat = (update: (chat: ChatState) => ChatState) => set({ chat: update(state.chat) });

  /** Tells the MCP server the exposed connections, only when they changed. */
  function refreshExposure() {
    const connections = exposable(open, hidden);
    set({ connections });
    const exposed = exposedOf(connections);
    if (told && sameExposure(told, exposed)) return;
    told = exposed;
    gateway.setExposed(exposed).catch(() => (told = null));
  }

  return {
    current: () => state,
    subscribe(listener: (state: ClaudeState) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Starts listening to the backend and checks the token; later calls do nothing. */
    async start() {
      if (started) return;
      started = true;
      await gateway.onChatEvent((event) => setChat((chat) => applyEvent(chat, event)));
      await gateway.onActivity((entry) => set({ activity: recordActivity(state.activity, entry) }));
      const saved = await gateway.hasToken().catch(() => false);
      set({ token: saved ? "saved" : "missing" });
    },

    /** The open sessions changed. */
    setOpenConnections(connections: OpenConnection[]) {
      open = connections;
      refreshExposure();
    },
    setExposed(id: string, exposed: boolean) {
      hidden = withExposure(hidden, id, exposed);
      prefs.save(hidden);
      refreshExposure();
    },

    /** Rejects with the reason when the text isn't a setup token. */
    async saveToken(token: string) {
      await gateway.saveToken(token.trim());
      set({ token: "saved" });
    },
    async forgetToken() {
      await gateway.forgetToken();
      set({ token: "missing", chat: EMPTY_CHAT });
    },

    async send(text: string) {
      const message = text.trim();
      if (!message || state.chat.busy) return;
      setChat((chat) => userSent(chat, message));
      try {
        await gateway.send(message);
      } catch (e) {
        setChat((chat) => sendFailed(chat, errorMessage(e)));
      }
    },
    stop: () => gateway.stop(),
    async newConversation() {
      await gateway.newConversation();
      set({ chat: EMPTY_CHAT });
    },
    clearActivity: () => set({ activity: state.activity.filter((a) => a.status === "running") }),
  };
}
