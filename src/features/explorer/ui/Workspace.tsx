import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useDataOperations } from "../../../app/operations/useDataOperations";
import { useServices } from "../../../app/services";
import { DocumentSyncContext, type SyncDocuments } from "../../../shared/ui/documentSyncAction";
import { LogPanel } from "../../../shared/ui/LogPanel";
import { StackSplit } from "../../../shared/ui/StackSplit";
import { NoticeToast } from "../../../shared/ui/NoticeToast";
import { SplitPane } from "../../../shared/ui/SplitPane";
import { useLog } from "../../../shared/ui/useLog";
import { useNotify } from "../../../shared/ui/useNotifications";
import type { SelectionOrigin } from "../../../shared/domain/selection";
import { useBackupFlow } from "../../backup/ui/useBackupFlow";
import { useRestoreFlow } from "../../backup/ui/useRestoreFlow";
import { displayName, type MongoConnection } from "../../connections/domain/connection";
import { SAFE_MODE_ERROR } from "../../connections/domain/safeMode";
import { useLeftoverCleanup } from "../../sync/ui/useLeftoverCleanup";
import { useDocumentSyncFlow } from "../../sync/ui/useDocumentSyncFlow";
import { useSyncFlow } from "../../sync/ui/useSyncFlow";
import { useReadOnly } from "../../connections/ui/useReadOnly";
import type { BorrowedSession, Session } from "../../connections/domain/session";
import { isMenuScript, type MenuScriptKind } from "../../shell/domain/menuScripts";
import { childCount, databaseNode, databaseNodes, serverKey, serverNode, type TreeNode } from "../domain/tree";
import { listChanges } from "../domain/pinnedDatabases";
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
  /** The connection clicked in the tree, only while the selection is that connection itself. */
  selectedConnection: string | undefined;
  refreshAll: () => void;
  /** Database nodes of a server session, as loaded in the tree. */
  databases: (sid: string) => TreeNode[];
  /** Selects `node` in the tree, opening it and its ancestors. */
  reveal: (node: TreeNode) => void;
  /** Adds `names` (maybe none) to the connection's list as temporary, reloads it and selects the first one. */
  openDatabases: (sid: string, names: string[]) => void;
  /** Leaves the connection's list with exactly `checked` (favorites always stay), as the "Bases de datos" window asks. */
  showDatabases: (sid: string, checked: string[]) => void;
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
  /** Takes a database out of its connection's list (temporary or favorite). */
  onRemoveFromList: (sid: string, db: string) => Promise<void>;
  sidebarHidden: boolean;
  logsOpen: boolean;
  onCloseLogs: () => void;
  onDisconnect: (sid: string) => void;
  /** "Abrir shell" on a node (or double click on a collection), or a menu entry that opens one with `script`. */
  onOpenShell: (node: TreeNode, script?: MenuScriptKind) => void;
  /** Ctrl+Enter on a collection in the tree: runs its shell tab, opening one if it has none. */
  onRunCollection: (node: TreeNode) => void;
  /** A collection is being dragged out of the tree (null once dropped), to open it in the shell. */
  onDragCollection: (node: TreeNode | null) => void;
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
    onRemoveFromList: props.onRemoveFromList,
    showPanel: (key, mode) => {
      setPanel(mode ? { key, mode } : null);
      onShowDetails();
    },
    notify: ok,
    fail,
  });
  const data = useDataOperations(connections, actions.refreshAll);
  useLeftoverCleanup(sessions, actions.refreshAll);
  // Sync, backup and restore are chosen and confirmed in their own windows (this one stays disabled)
  // and run in the operations panel.
  const flow = { connections, sessions, borrowSession: props.onBorrowSession, busyReason: data.busyReason };
  const flows: Partial<Record<Action, OperationFlow>> = {
    syncDatabase: { open: useSyncFlow({ ...flow, run: data.sync }), name: "sincronización" },
    backupDatabase: { open: useBackupFlow({ ...flow, busyElsewhere: data.busyElsewhere, run: data.backup }), name: "backup" },
    restoreDatabase: { open: useRestoreFlow({ ...flow, run: data.restore }), name: "restore" },
  };
  // The documents picked in the viewer (R97); the viewer reaches it through DocumentSyncContext.
  const openDocumentSync = useDocumentSyncFlow({ ...flow, run: data.syncDocuments });
  const syncDocuments = useCallback<SyncDocuments>(
    (target, docs) =>
      void openDocumentSync(target, docs).catch((e) => {
        fail(e);
        log.error("No se pudo abrir la sincronización de documentos", e);
      }),
    [openDocumentSync, fail, log],
  );

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

  const openDatabases = (sid: string, names: string[]) => {
    const server = tree.node(serverKey(sid));
    if (!server) return;
    explorer.openTemporary(sid, names);
    tree.refresh(server);
    if (names.length) tree.reveal(databaseNode(server, names[0]));
  };

  const showDatabases = (sid: string, checked: string[]) => {
    const { open, close } = listChanges(checked, explorer.favoritesOf(sid), explorer.temporariesOf(sid));
    close.forEach((name) => explorer.forgetTemporary(sid, name));
    openDatabases(sid, open);
  };

  const selected = tree.node(tree.selected) ?? roots[0];
  const controls: WorkspaceControls = {
    selected,
    selectedConnection: tree.node(tree.selected)?.kind === "server" ? selected.sid : undefined,
    refreshAll: actions.refreshAll,
    databases: (sid) => databaseNodes(tree.children.get(serverKey(sid)) ?? []),
    reveal: tree.reveal,
    openDatabases,
    showDatabases,
    openMongosh,
    runAction: onAction,
  };
  const readOnlySelected = !!selected && isReadOnly(selected.sid);
  const mode: PanelMode = panel && panel.key === selected?.key ? panel.mode : "default";
  const selectedKids = selected && tree.children.get(selected.key);

  const details = selected && (
    <DetailPanel
      node={selected}
      mode={mode}
      version={actions.version}
      childCount={selectedKids ? childCount(selectedKids) : undefined}
      onAction={(m) => setPanel({ key: selected.key, mode: m })}
      onEditIndex={readOnlySelected ? undefined : (ix) => actions.editIndex(selected, ix)}
      onDropIndex={readOnlySelected ? undefined : (ix) => actions.dropIndex(selected, ix)}
    />
  );

  return (
    <div className="workspace">
      {props.renderToolbar(controls)}

      <SplitPane sideClassName="ws-sidebar" initialWidth={250} sideHidden={sidebarHidden} side={<Explorer tree={tree} onAction={onAction} onRunCollection={props.onRunCollection} onDragCollection={props.onDragCollection} />}>
        {/* The logs open under the main area only (never under the explorer), at half its height. */}
        <div className="ws-main">
          <StackSplit
            label="Redimensionar área principal y logs"
            initialRatio={0.5}
            bottomHidden={!logsOpen}
            top={<DocumentSyncContext.Provider value={syncDocuments}>{props.renderMain(details, selected)}</DocumentSyncContext.Provider>}
            bottom={<LogPanel onClose={onCloseLogs} />}
          />
        </div>
      </SplitPane>

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
