// The conversation shown in the Claude tab, rebuilt from the events of the backend. Pure.

/** What the backend tells about the conversation (`claude://event`). */
export type ChatEvent =
  | { kind: "ready"; model: string }
  | { kind: "textDelta"; text: string }
  /** A whole text block: it replaces the deltas received since the previous one. */
  | { kind: "text"; text: string }
  | { kind: "toolUse"; id: string; name: string; input: unknown }
  | { kind: "toolResult"; id: string; isError: boolean; text: string }
  | { kind: "turnEnd"; error: string | null; costUsd: number | null }
  | { kind: "stopped" }
  | { kind: "exited"; reason: string };

export type ToolStatus = "running" | "ok" | "error" | "stopped";

export type ChatItem =
  | { kind: "user"; text: string }
  /** `streaming` while Claude is still writing this block. */
  | { kind: "assistant"; text: string; streaming: boolean }
  | { kind: "tool"; id: string; name: string; input: unknown; status: ToolStatus; result?: string }
  | { kind: "notice"; tone: "info" | "error"; text: string };

export interface ChatState {
  items: ChatItem[];
  /** A turn is under way: the input waits and "Detener" is offered. */
  busy: boolean;
  model: string | null;
  /** What the conversation has cost so far, as Claude Code reports it. */
  costUsd: number;
}

export const EMPTY_CHAT: ChatState = { items: [], busy: false, model: null, costUsd: 0 };

export const STOPPED_NOTICE = "Respuesta detenida";

const last = (items: ChatItem[]) => items[items.length - 1];

/** Ends the block being written and the tool calls left without result. */
function settle(items: ChatItem[], toolStatus: ToolStatus): ChatItem[] {
  return items.map((item) => {
    if (item.kind === "assistant" && item.streaming) return { ...item, streaming: false };
    if (item.kind === "tool" && item.status === "running") return { ...item, status: toolStatus };
    return item;
  });
}

/** Adds `text` to the block being written (or replaces it), or starts a new block. */
function withText(items: ChatItem[], text: string, streaming: boolean, append: boolean): ChatItem[] {
  const tail = last(items);
  if (tail?.kind === "assistant" && tail.streaming) {
    const next = append ? tail.text + text : text;
    return [...items.slice(0, -1), { kind: "assistant", text: next, streaming }];
  }
  return [...items, { kind: "assistant", text, streaming }];
}

function ended(state: ChatState, toolStatus: ToolStatus, notice?: ChatItem): ChatState {
  const items = settle(state.items, toolStatus);
  return { ...state, busy: false, items: notice ? [...items, notice] : items };
}

const errorNotice = (text: string): ChatItem => ({ kind: "notice", tone: "error", text });

/** The message the user just sent; the turn starts. */
export function userSent(state: ChatState, text: string): ChatState {
  return { ...state, busy: true, items: [...state.items, { kind: "user", text }] };
}

/** Sending failed before Claude heard it. */
export function sendFailed(state: ChatState, error: string): ChatState {
  return ended(state, "error", errorNotice(error));
}

export function applyEvent(state: ChatState, event: ChatEvent): ChatState {
  switch (event.kind) {
    case "ready":
      return { ...state, model: event.model };
    case "textDelta":
      return { ...state, items: withText(state.items, event.text, true, true) };
    case "text":
      return { ...state, items: withText(state.items, event.text, false, false) };
    case "toolUse": {
      const tool: ChatItem = { kind: "tool", id: event.id, name: event.name, input: event.input, status: "running" };
      return { ...state, items: [...state.items, tool] };
    }
    case "toolResult":
      return {
        ...state,
        items: state.items.map((item) =>
          item.kind === "tool" && item.id === event.id ? { ...item, status: event.isError ? "error" : "ok", result: event.text } : item,
        ),
      };
    case "turnEnd": {
      const next = ended(state, "error", event.error ? errorNotice(event.error) : undefined);
      return { ...next, costUsd: state.costUsd + (event.costUsd ?? 0) };
    }
    case "stopped":
      return ended(state, "stopped", { kind: "notice", tone: "info", text: STOPPED_NOTICE });
    case "exited":
      return ended(state, "error", errorNotice(event.reason));
  }
}
