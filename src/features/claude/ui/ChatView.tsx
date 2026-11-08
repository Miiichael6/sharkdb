import { useState, type KeyboardEvent } from "react";
import { useNotify } from "../../../shared/ui/useNotifications";
import { formatCost } from "../domain/format";
import { ChatMessages } from "./ChatMessages";
import { useClaude } from "./useClaude";

const EXAMPLES = ["¿Qué colecciones hay y cuántos documentos tiene cada una?", "Describe el esquema de la colección más grande"];

/** The conversation with Claude and the box to write to it. */
export function ChatView({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { state, claude } = useClaude();
  const { chat, connections } = state;
  const [draft, setDraft] = useState("");
  const notify = useNotify();
  const exposed = connections.filter((c) => c.exposed).length;

  const send = (text: string) => {
    if (!text.trim() || chat.busy) return;
    setDraft("");
    void claude.send(text);
  };
  // Enter sends; Shift+Enter starts a new line.
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    send(draft);
  };

  return (
    <div className="claude-chat">
      <div className="claude-chat-bar">
        <span className="claude-muted small">
          {[chat.model, chat.costUsd > 0 && formatCost(chat.costUsd)].filter(Boolean).join(" · ") || "Conversación nueva"}
        </span>
        <button type="button" className="ghost small" disabled={!chat.items.length} onClick={() => claude.newConversation().catch(notify.fail)}>
          Nueva conversación
        </button>
      </div>

      {chat.items.length ? (
        <ChatMessages items={chat.items} busy={chat.busy} />
      ) : (
        <div className="claude-messages claude-examples">
          <p className="claude-muted">Pregunta lo que quieras sobre tus bases de datos. Por ejemplo:</p>
          {EXAMPLES.map((example) => (
            <button key={example} type="button" className="ghost" disabled={!exposed} onClick={() => send(example)}>
              {example}
            </button>
          ))}
        </div>
      )}

      {!exposed && (
        <p className="claude-notice info">
          Claude no tiene ninguna conexión que consultar.{" "}
          <button type="button" className="ghost small" onClick={onOpenSettings}>
            Elegir conexiones
          </button>
        </p>
      )}
      <div className="claude-composer">
        <textarea
          value={draft}
          rows={3}
          placeholder="Escribe a Claude… (Mayús+Intro para otra línea)"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {chat.busy ? (
          <button type="button" onClick={() => claude.stop().catch(notify.fail)}>
            Detener
          </button>
        ) : (
          <button type="button" className="primary" disabled={!draft.trim()} onClick={() => send(draft)}>
            Enviar
          </button>
        )}
      </div>
    </div>
  );
}
