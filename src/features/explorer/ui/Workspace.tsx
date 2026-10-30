import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useServices } from "../../../app/services";
import { LogPanel } from "../../../shared/ui/LogPanel";
import { NoticeToast } from "../../../shared/ui/NoticeToast";
import { SplitPane } from "../../../shared/ui/SplitPane";
import { useLog } from "../../../shared/ui/useLog";
import { useNotice } from "../../../shared/ui/useNotice";
import { displayName } from "../../connections/domain/connection";
import type { Session } from "../../connections/domain/session";
import { databaseNodes, serverKey, serverNode, type TreeNode } from "../domain/tree";
import { useTree } from "./useTree";
import { DetailPanel, type PanelMode } from "./DetailPanel";
import { Explorer, type Action } from "./Explorer";
import { ExplorerDialogs } from "./ExplorerDialogs";
import { useExplorerActions } from "./useExplorerActions";

/** What the workspace toolbar can do with the explorer. */
export interface WorkspaceControls {
  /** The tree's selection (the first server when nothing is selected). */
  selected: TreeNode | undefined;
  refreshAll: () => void;
  /** Database nodes of a server session, as loaded in the tree. */
  databases: (sid: string) => TreeNode[];
  /** Selects `node` in the tree, opening it and its ancestors. */
  reveal: (node: TreeNode) => void;
  openMongosh: (sid: string, db?: string) => void;
}

interface Props {
  sessions: Session[];
  sidebarHidden: boolean;
  logsOpen: boolean;
  onCloseLogs: () => void;
  onDisconnect: (sid: string) => void;
  /** "Abrir shell" on a node (or double click on a collection). */
  onOpenShell: (node: TreeNode) => void;
  /** The detail panel was asked for (a panel action in the tree). */
  onShowDetails: () => void;
  /** Main area around the detail panel (the shell tabs); `selected` is the tree's selection. */
  renderMain: (details: ReactNode, selected: TreeNode | undefined) => ReactNode;
  renderToolbar: (controls: WorkspaceControls) => ReactNode;
}

export function Workspace(props: Props) {
  const { sessions, sidebarHidden, logsOpen, onCloseLogs, onDisconnect, onOpenShell, onShowDetails } = props;
  const roots = useMemo(
    () => sessions.map((s) => serverNode(s.conn.id, displayName(s.conn))),
    [sessions],
  );
  const { explorer, terminal } = useServices();
  const tree = useTree(roots, explorer.loadChildren);
  const [panel, setPanel] = useState<{ key: string; mode: PanelMode } | null>(null);
  const { notice, ok, fail, dismiss } = useNotice();
  const log = useLog();
  const actions = useExplorerActions({
    tree,
    onDisconnect,
    showPanel: (key, mode) => {
      setPanel(mode ? { key, mode } : null);
      onShowDetails();
    },
    notify: ok,
    fail,
  });

  const openMongosh = useCallback(
    (sid: string, db?: string) =>
      terminal.openMongosh(sid, db).then(
        () => log.info(`mongosh abierto${db ? ` en ${db}` : ""}`),
        (e) => {
          fail(e);
          log.error("No se pudo abrir mongosh", e);
        },
      ),
    [terminal, fail, log],
  );

  const onAction = (action: Action, n: TreeNode) => {
    if (action === "openShell") onOpenShell(n);
    else if (action === "openMongosh") openMongosh(n.sid, n.db);
    else actions.onAction(action, n);
  };

  const selected = tree.node(tree.selected) ?? roots[0];
  const controls: WorkspaceControls = {
    selected,
    refreshAll: actions.refreshAll,
    databases: (sid) => databaseNodes(tree.children.get(serverKey(sid)) ?? []),
    reveal: tree.reveal,
    openMongosh,
  };
  const mode: PanelMode = panel && panel.key === selected?.key ? panel.mode : "default";

  const details = selected && (
    <DetailPanel
      node={selected}
      mode={mode}
      version={actions.version}
      childCount={tree.children.get(selected.key)?.length}
      onAction={(m) => setPanel({ key: selected.key, mode: m })}
      onEditIndex={(ix) => actions.editIndex(selected, ix)}
      onDropIndex={(ix) => actions.dropIndex(selected, ix)}
    />
  );

  return (
    <div className="workspace">
      {props.renderToolbar(controls)}

      <SplitPane sideClassName="ws-sidebar" sideHidden={sidebarHidden} side={<Explorer tree={tree} onAction={onAction} />}>
        {props.renderMain(details, selected)}
      </SplitPane>

      {logsOpen && <LogPanel onClose={onCloseLogs} />}

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
