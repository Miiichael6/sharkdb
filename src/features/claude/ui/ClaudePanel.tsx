import { useState } from "react";
import { ActivityView } from "./ActivityView";
import { ChatView } from "./ChatView";
import { ClaudeSettings } from "./ClaudeSettings";
import { TokenSetup } from "./TokenSetup";
import { useClaude } from "./useClaude";

type View = "chat" | "activity" | "settings";

/** The Claude tab of the right sidebar: first the setup token, then the chat, its MCP activity and its settings. */
export function ClaudePanel() {
  const { state } = useClaude();
  const [view, setView] = useState<View>("chat");
  const running = state.activity.filter((a) => a.status === "running").length;

  if (state.token !== "saved") {
    return (
      <section className="claude-panel" aria-label="Claude">
        {state.token === "checking" ? <p className="empty">Comprobando el token…</p> : <TokenSetup />}
      </section>
    );
  }

  const views: { id: View; label: string }[] = [
    { id: "chat", label: "Chat" },
    { id: "activity", label: running ? `Actividad MCP (${running})` : "Actividad MCP" },
    { id: "settings", label: "Ajustes" },
  ];
  return (
    <section className="claude-panel" aria-label="Claude">
      <nav className="segmented claude-views">
        {views.map((v) => (
          <button key={v.id} type="button" className={v.id === view ? "active" : undefined} aria-pressed={v.id === view} onClick={() => setView(v.id)}>
            {v.label}
          </button>
        ))}
      </nav>
      {view === "chat" && <ChatView onOpenSettings={() => setView("settings")} />}
      {view === "activity" && <ActivityView />}
      {view === "settings" && <ClaudeSettings />}
    </section>
  );
}
