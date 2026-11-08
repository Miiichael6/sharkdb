import type { McpActivity } from "../domain/activity";
import type { ChatEvent } from "../domain/chat";
import type { ExposedConnection } from "../domain/exposure";

/** Stops listening. */
export type Unlisten = () => void;

/** The chat with Claude Code and the app's MCP server, both run by the backend. */
export interface ClaudeGateway {
  /** Whether the setup token is saved in the system keyring. */
  hasToken(): Promise<boolean>;
  /** Rejects with the reason when the pasted text isn't a setup token. */
  saveToken(token: string): Promise<void>;
  /** Forgets the token and ends the conversation that was using it. */
  forgetToken(): Promise<void>;
  /** Sends a message, starting Claude Code if needed; its answer comes as chat events. */
  send(text: string): Promise<void>;
  /** Cuts the answer under way; the conversation is kept. */
  stop(): Promise<void>;
  newConversation(): Promise<void>;
  /** The connections the MCP server may use. */
  setExposed(connections: ExposedConnection[]): Promise<void>;
  onChatEvent(listener: (event: ChatEvent) => void): Promise<Unlisten>;
  onActivity(listener: (entry: McpActivity) => void): Promise<Unlisten>;
}

/** The connections the user unchecked, remembered across restarts. */
export interface ExposurePrefs {
  load(): string[];
  save(hidden: string[]): void;
}
