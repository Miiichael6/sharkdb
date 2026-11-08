import { useEffect, useRef } from "react";
import type { ChatItem } from "../domain/chat";
import { ToolCallCard } from "./ToolCallCard";

function Message({ item }: { item: ChatItem }) {
  switch (item.kind) {
    case "user":
      return <div className="claude-msg user">{item.text}</div>;
    case "assistant":
      return <div className={item.streaming ? "claude-msg assistant streaming" : "claude-msg assistant"}>{item.text}</div>;
    case "tool":
      return <ToolCallCard item={item} />;
    case "notice":
      return <div className={`claude-notice ${item.tone}`}>{item.text}</div>;
  }
}

/** The conversation, kept scrolled to the newest message. */
export function ChatMessages({ items, busy }: { items: ChatItem[]; busy: boolean }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [items]);
  const waiting = busy && items[items.length - 1]?.kind === "user";

  return (
    <div className="claude-messages" aria-live="polite">
      {items.map((item, i) => (
        <Message key={item.kind === "tool" ? item.id : i} item={item} />
      ))}
      {waiting && <div className="claude-muted small">Claude está pensando…</div>}
      <div ref={end} />
    </div>
  );
}
