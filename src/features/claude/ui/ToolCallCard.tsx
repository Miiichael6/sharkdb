import type { ChatItem } from "../domain/chat";
import { prettyJson } from "../domain/format";

type ToolItem = Extract<ChatItem, { kind: "tool" }>;

const STATUS_LABEL: Record<ToolItem["status"], string> = {
  running: "En curso",
  ok: "Hecho",
  error: "Error",
  stopped: "Detenida",
};

/** One MCP call inside the conversation: collapsed to its name, open to its arguments and reply. */
export function ToolCallCard({ item }: { item: ToolItem }) {
  return (
    <details className="claude-tool" data-status={item.status}>
      <summary>
        <span className="claude-dot" aria-hidden />
        <span className="claude-tool-name">{item.name}</span>
        <span className="claude-muted small">{STATUS_LABEL[item.status]}</span>
      </summary>
      <h5>Argumentos</h5>
      <pre>{prettyJson(item.input)}</pre>
      {item.result !== undefined && (
        <>
          <h5>Resultado</h5>
          <pre>{item.result}</pre>
        </>
      )}
    </details>
  );
}
