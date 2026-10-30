import { useMemo, useState } from "react";
import { useServices } from "../../../app/services";
import { NoticeToast } from "../../../shared/ui/NoticeToast";
import { SplitPane } from "../../../shared/ui/SplitPane";
import { useNotice } from "../../../shared/ui/useNotice";
import { displayName } from "../../connections/domain/connection";
import type { Session } from "../../connections/domain/session";
import { serverNode } from "../domain/tree";
import { useTree } from "./useTree";
import { DetailPanel, type PanelMode } from "./DetailPanel";
import { Explorer } from "./Explorer";
import { ExplorerDialogs } from "./ExplorerDialogs";
import { useExplorerActions } from "./useExplorerActions";

interface Props {
  sessions: Session[];
  onDisconnect: (sid: string) => void;
  onShowConnections: () => void;
}

export function Workspace({ sessions, onDisconnect, onShowConnections }: Props) {
  const roots = useMemo(
    () => sessions.map((s) => serverNode(s.conn.id, displayName(s.conn))),
    [sessions],
  );
  const { explorer } = useServices();
  const tree = useTree(roots, explorer.loadChildren);
  const [panel, setPanel] = useState<{ key: string; mode: PanelMode } | null>(null);
  const { notice, ok, fail, dismiss } = useNotice();
  const actions = useExplorerActions({
    tree,
    onDisconnect,
    showPanel: (key, mode) => setPanel(mode ? { key, mode } : null),
    notify: ok,
    fail,
  });

  const selected = tree.node(tree.selected) ?? roots[0];
  const mode: PanelMode = panel && panel.key === selected?.key ? panel.mode : "default";

  return (
    <div className="workspace">
      <header className="ws-header">
        <button onClick={onShowConnections} title="Abrir otra conexión">
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
            <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Conexiones
        </button>
        <span className="muted">
          {sessions.length} {sessions.length === 1 ? "conexión abierta" : "conexiones abiertas"}
        </span>
        <span className="spacer" />
        <span className="muted small">Clic derecho en el árbol para más acciones · F5 refresca</span>
      </header>

      <SplitPane sideClassName="ws-sidebar" side={<Explorer tree={tree} onAction={actions.onAction} />}>
        {selected && (
          <DetailPanel
            node={selected}
            mode={mode}
            version={actions.version}
            childCount={tree.children.get(selected.key)?.length}
            onAction={(m) => setPanel({ key: selected.key, mode: m })}
            onEditIndex={(ix) => actions.editIndex(selected, ix)}
            onDropIndex={(ix) => actions.dropIndex(selected, ix)}
          />
        )}
      </SplitPane>

      <NoticeToast notice={notice} onDismiss={dismiss} />

      <ExplorerDialogs
        dialog={actions.dialog}
        onClose={actions.closeDialog}
        onSubmitIndex={actions.submitIndex}
        onConfirm={actions.confirm}
      />
    </div>
  );
}
