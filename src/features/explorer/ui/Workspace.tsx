import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useDataOperations } from "../../../app/operations/useDataOperations";
import { useServices } from "../../../app/services";
import { LogPanel } from "../../../shared/ui/LogPanel";
import { NoticeToast } from "../../../shared/ui/NoticeToast";
import { SplitPane } from "../../../shared/ui/SplitPane";
import { useLog } from "../../../shared/ui/useLog";
import { useNotify } from "../../../shared/ui/useNotifications";
import type { SelectionOrigin } from "../../../shared/domain/selection";
import { useBackupFlow } from "../../backup/ui/useBackupFlow";
import { useRestoreFlow } from "../../backup/ui/useRestoreFlow";
import { displayName, type MongoConnection } from "../../connections/domain/connection";
import { SAFE_MODE_ERROR } from "../../connections/domain/safeMode";
import { useSyncFlow } from "../../sync/ui/useSyncFlow";
import { useReadOnly } from "../../connections/ui/useReadOnly";
import type { BorrowedSession, Session } from "../../connections/domain/session";
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

/** An operation chosen in its own windows: how to open them, and its name for the error. */
interface OperationFlow {
  open: (origin: SelectionOrigin) => Promise<void>;
  name: string;
}

interface Props {
  sessions: Session[];
  /** Every registered connection: the sync can use closed ones too. */
  connections: MongoConnection[];
  /** Opens a registered connection by id (or returns its session when it's already open). */
  onBorrowSession: (id: string) => Promise<BorrowedSession>;
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
  const { sessions, connections, sidebarHidden, logsOpen, onCloseLogs, onDisconnect, onOpenShell, onShowDetails } = props;
  const roots = useMemo(
    () => sessions.map((s) => serverNode(s.conn.id, displayName(s.conn))),
    [sessions],
  );
  const { explorer, terminal } = useServices();
  const tree = useTree(roots, explorer.loadChildren);
  const [panel, setPanel] = useState<{ key: string; mode: PanelMode } | null>(null);
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
  const data = useDataOperations(connections, actions.refreshAll);
  // Sync, backup and restore are chosen and confirmed in their own windows (this one stays disabled)
  // and run in the operations panel.
  const flow = { connections, sessions, borrowSession: props.onBorrowSession, busyReason: data.busyReason };
  const flows: Partial<Record<Action, OperationFlow>> = {
    syncDatabase: { open: useSyncFlow({ ...flow, run: data.sync }), name: "sincronización" },
    backupDatabase: { open: useBackupFlow({ ...flow, run: data.backup }), name: "backup" },
    restoreDatabase: { open: useRestoreFlow({ ...flow, run: data.restore }), name: "restore" },
  };

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

  /** Opens an operation's windows with `n` (a connection, database or collection) preselected. */
  const openFlow = ({ open, name }: OperationFlow, n: TreeNode) =>
    open({ sid: n.sid, db: n.db, collection: n.coll }).catch((e) => log.error(`No se pudo abrir la ventana de ${name}`, e));

  const onAction = (action: Action, n: TreeNode) => {
    // Covers every entry point (menu, palette, toolbar); the backend would reject it anyway.
    if (isReadOnly(n.sid) && blockedInSafeMode(action)) fail(SAFE_MODE_ERROR);
    else if (action === "openShell") onOpenShell(n);
    else if (isMenuScript(action)) onOpenShell(n, action);
    else if (action === "openMongosh") openMongosh(n.sid, n.db);
    else if (flows[action]) void openFlow(flows[action], n);
    else actions.onAction(action, n);
  };

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
    </div>
  );
}
