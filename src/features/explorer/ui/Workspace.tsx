import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useServices } from "../../../app/services";
import { LogPanel } from "../../../shared/ui/LogPanel";
import { openModalWindow } from "../../../shared/ui/modalWindow";
import { NoticeToast } from "../../../shared/ui/NoticeToast";
import { SplitPane } from "../../../shared/ui/SplitPane";
import { useLog } from "../../../shared/ui/useLog";
import { useNotify } from "../../../shared/ui/useNotifications";
import { backupSummary, restoreSummary } from "../../backup/domain/backupSpec";
import { BackupDialog } from "../../backup/ui/BackupDialog";
import { RestoreDialog } from "../../backup/ui/RestoreDialog";
import { displayName } from "../../connections/domain/connection";
import { SAFE_MODE_ERROR } from "../../connections/domain/safeMode";
import { syncSummary } from "../../sync/domain/syncPlan";
import { SYNC_VIEW, SYNC_WINDOW, type SyncWindowData, type SyncWindowResult } from "../../sync/ui/SyncWindow";
import { useReadOnly } from "../../connections/ui/useReadOnly";
import type { Session } from "../../connections/domain/session";
import { isMenuScript, type MenuScriptKind } from "../../shell/domain/menuScripts";
import { databaseNodes, serverKey, serverNode, type TreeNode } from "../domain/tree";
import { blockedInSafeMode } from "../domain/writeActions";
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
  /** Runs a context-menu action on `node`, exactly as the tree does. */
  runAction: (action: Action, node: TreeNode) => void;
}

interface Props {
  sessions: Session[];
  sidebarHidden: boolean;
  logsOpen: boolean;
  onCloseLogs: () => void;
  onDisconnect: (sid: string) => void;
  /** "Abrir shell" on a node (or double click on a collection), or a menu entry that opens one with `script`. */
  onOpenShell: (node: TreeNode, script?: MenuScriptKind) => void;
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
  // Backup and restore run in their own dialogs, open while the job runs.
  const [operation, setOperation] = useState<{ kind: "backup" | "restore"; node: TreeNode } | null>(null);
  const { ok, fail } = useNotify();
  const isReadOnly = useReadOnly();
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

  /** The sync runs in its own window, which keeps this one disabled until it closes. */
  const openSync = async (n: TreeNode) => {
    const data: SyncWindowData = { sessions, origin: { sid: n.sid, db: n.db, collection: n.coll } };
    let result: SyncWindowResult | null;
    try {
      result = await openModalWindow<SyncWindowResult>(SYNC_VIEW, data, SYNC_WINDOW);
    } catch (e) {
      log.error("No se pudo abrir la ventana de sincronización", e);
      return;
    }
    // Refreshed even without a result: a cancelled sync may have replaced some collections.
    actions.refreshAll();
    if (result) ok(syncSummary(connectionName(result.target.sid), result.target.databases, result.results));
  };

  const onAction = (action: Action, n: TreeNode) => {
    // Covers every entry point (menu, palette, toolbar); the backend would reject it anyway.
    if (isReadOnly(n.sid) && blockedInSafeMode(action)) fail(SAFE_MODE_ERROR);
    else if (action === "openShell") onOpenShell(n);
    else if (isMenuScript(action)) onOpenShell(n, action);
    else if (action === "openMongosh") openMongosh(n.sid, n.db);
    else if ((action === "backupDatabase" || action === "restoreDatabase") && n.db)
      setOperation({ kind: action === "backupDatabase" ? "backup" : "restore", node: n });
    else if (action === "syncDatabase") void openSync(n);
    else actions.onAction(action, n);
  };

  const connectionName = (sid: string) => roots.find((r) => r.sid === sid)?.label ?? sid;

  const selected = tree.node(tree.selected) ?? roots[0];
  const controls: WorkspaceControls = {
    selected,
    refreshAll: actions.refreshAll,
    databases: (sid) => databaseNodes(tree.children.get(serverKey(sid)) ?? []),
    reveal: tree.reveal,
    openMongosh,
    runAction: onAction,
  };
  const readOnlySelected = !!selected && isReadOnly(selected.sid);
  const mode: PanelMode = panel && panel.key === selected?.key ? panel.mode : "default";

  const details = selected && (
    <DetailPanel
      node={selected}
      mode={mode}
      version={actions.version}
      childCount={tree.children.get(selected.key)?.length}
      onAction={(m) => setPanel({ key: selected.key, mode: m })}
      onEditIndex={readOnlySelected ? undefined : (ix) => actions.editIndex(selected, ix)}
      onDropIndex={readOnlySelected ? undefined : (ix) => actions.dropIndex(selected, ix)}
    />
  );

  return (
    <div className="workspace">
      {props.renderToolbar(controls)}

      <SplitPane sideClassName="ws-sidebar" sideHidden={sidebarHidden} side={<Explorer tree={tree} onAction={onAction} />}>
        {props.renderMain(details, selected)}
      </SplitPane>

      {logsOpen && <LogPanel onClose={onCloseLogs} />}

      <NoticeToast />

      <ExplorerDialogs
        dialog={actions.dialog}
        databases={(sid) => controls.databases(sid).map((d) => d.label)}
        onClose={actions.closeDialog}
        onSubmitIndex={actions.submitIndex}
        onSubmitUser={actions.submitUser}
        onCopy={actions.submitCopy}
      />

      {operation?.kind === "backup" && (
        <BackupDialog
          sid={operation.node.sid}
          db={operation.node.db!}
          connection={connectionName(operation.node.sid)}
          onDone={(results) => {
            setOperation(null);
            ok(backupSummary(operation.node.db!, results));
          }}
          onClose={() => setOperation(null)}
        />
      )}
      {operation?.kind === "restore" && (
        <RestoreDialog
          sessions={sessions}
          initial={{ sid: operation.node.sid, db: operation.node.db! }}
          onDone={(results, target) => {
            setOperation(null);
            // The destination may be a new database or have new collections.
            actions.refreshAll();
            ok(`${restoreSummary(target.db, results)} · ${connectionName(target.sid)}`);
          }}
          onClose={() => setOperation(null)}
        />
      )}
    </div>
  );
}
