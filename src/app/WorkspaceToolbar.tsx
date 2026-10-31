// Wires the workspace toolbar to the explorer, the shell tabs and the open sessions.
import { useState } from "react";
import type { ContextMenuItem } from "../shared/ui/ContextMenu";
import { displayName, type MongoConnection } from "../features/connections/domain/connection";
import type { Session } from "../features/connections/domain/session";
import {
  OPEN_CONNECTION_VIEW,
  type OpenConnectionData,
  type OpenConnectionResult,
} from "../features/connections/ui/OpenConnectionDialog";
import { serverNode } from "../features/explorer/domain/tree";
import type { Action } from "../features/explorer/ui/Explorer";
import type { WorkspaceControls } from "../features/explorer/ui/Workspace";
import type { NewTab } from "../features/shell/domain/tabs";
import type { ScriptFileActions } from "../features/shell/ui/useScriptFileActions";
import type { ShellTabs } from "../features/shell/ui/useShellTabs";
import type { StatusContext } from "../features/workspace/domain/statusLabel";
import { AboutDialog } from "../features/workspace/ui/AboutDialog";
import { QuickOpen } from "../features/workspace/ui/QuickOpen";
import { Toolbar } from "../features/workspace/ui/Toolbar";
import type { PanelLayout } from "../features/workspace/ui/usePanelLayout";
import { useToolbarShortcuts, type ToolbarHandlers } from "../features/workspace/ui/useToolbarShortcuts";
import { useWindowTitle } from "../features/workspace/ui/useWindowTitle";
import { confirmInWindow } from "../shared/ui/confirmInWindow";
import { openModalWindow } from "../shared/ui/modalWindow";
import { NO_CONNECTION_SELECTED } from "../features/workspace/domain/databaseChoice";
import { useLog } from "../shared/ui/useLog";
import { operationsBadge } from "../shared/domain/operations";
import { useOperations } from "./operations/useOperations";
import { useCurrentTarget } from "./useCurrentTarget";
import type { ChooseDatabases } from "./useDatabaseWindow";
import { useQuickOpen } from "./useQuickOpen";

interface Props {
  controls: WorkspaceControls;
  sessions: Session[];
  connections: MongoConnection[];
  tabs: ShellTabs;
  files: ScriptFileActions;
  layout: PanelLayout;
  /** Where a new tab (or an opened script) goes when no shell tab is active. */
  newTabTarget: () => NewTab | null;
  onNewConnection: () => void;
  onShowConnections: () => void;
  onConnect: (conn: MongoConnection) => void;
  /** Turns the read-only safe mode of a session on or off. */
  onSetSafeMode: (sid: string, enabled: boolean) => void;
  onChooseDatabases: ChooseDatabases;
}

export function WorkspaceToolbar(props: Props) {
  const { controls, sessions, connections, tabs, files, layout, newTabTarget, onNewConnection, onShowConnections, onConnect, onSetSafeMode } =
    props;
  const [aboutOpen, setAboutOpen] = useState(false);
  // Turning safe mode off on a protected connection asks first.
  const log = useLog();

  const target = useCurrentTarget(tabs.active, controls.selected);
  const session = target && sessions.find((s) => s.conn.id === target.sid);
  const status: StatusContext | null = session
    ? {
        tag: session.conn.tag,
        version: session.info.version,
        connection: displayName(session.conn),
        db: target.db,
        coll: target.coll,
        safeMode: session.safeMode,
      }
    : null;
  useWindowTitle(status ?? undefined);
  const quickOpen = useQuickOpen({ controls, sessions, connections, layout, target, onConnect });

  const targetDatabase = target ? controls.databases(target.sid).find((n) => n.db === target.db) : undefined;
  // "Bases de datos" only acts on the connection clicked in the tree, never on a guess.
  const selectedSession = sessions.find((s) => s.conn.id === controls.selectedConnection);
  const showDatabases = async () => {
    if (!selectedSession) return;
    let chosen: string[] | null;
    try {
      chosen = await props.onChooseDatabases(selectedSession, false);
    } catch (e) {
      log.error("No se pudo abrir la lista de bases de datos", e);
      return;
    }
    // The stars may have changed even when the window was just closed.
    if (chosen?.length) layout.showSidebar();
    controls.openDatabases(selectedSession.conn.id, chosen ?? []);
  };

  const showConnections = async () => {
    let result: OpenConnectionResult | null;
    try {
      const data: OpenConnectionData = { connections, openIds: sessions.map((s) => s.conn.id) };
      result = await openModalWindow<OpenConnectionResult>(OPEN_CONNECTION_VIEW, data, {
        title: "Abrir conexión",
        width: 480,
        height: 540,
      });
    } catch (e) {
      log.error("No se pudo abrir la lista de conexiones", e);
      return;
    }
    if (result?.kind === "new") return onNewConnection();
    const conn = result?.kind === "open" && connections.find((c) => c.id === result.id);
    if (conn) onConnect(conn);
  };

  const toggleSafeMode = () => {
    if (!session) return;
    if (session.safeMode && session.conn.protected) void confirmUnprotect(session);
    else onSetSafeMode(session.conn.id, !session.safeMode);
  };

  const confirmUnprotect = async (protectedSession: Session) => {
    const allowed = await confirmInWindow({
      title: "Desactivar safe mode",
      message: `“${displayName(protectedSession.conn)}” es una conexión protegida. ¿Permitir escrituras en esta sesión?`,
      confirmLabel: "Permitir escrituras",
    });
    if (allowed) onSetSafeMode(protectedSession.conn.id, false);
  };

  const operations = useOperations();
  const handlers: ToolbarHandlers = {
    toggleSidebar: layout.toggleSidebar,
    connections: () => void showConnections(),
    databases: () => void showDatabases(),
    openMongosh: () => target && controls.openMongosh(target.sid, target.db),
    openConnection: () => quickOpen.open("connection"),
    openDatabase: () => quickOpen.open("database"),
    quickActions: () => target && quickOpen.open("action"),
    refresh: controls.refreshAll,
    safeMode: toggleSafeMode,
    operations: operations.togglePanel,
    logs: layout.toggleLogs,
  };
  useToolbarShortcuts(handlers);

  // Sync, backup and restore choose their databases in their own window: the connection is enough.
  const runOnTarget = (action: Action) =>
    session && controls.runAction(action, targetDatabase ?? serverNode(session.conn.id, displayName(session.conn)));

  const menuItems: ContextMenuItem[] = [
    { label: "Nueva conexión…", onSelect: onNewConnection },
    { label: "Administrar conexiones…", onSelect: onShowConnections },
    { label: "Abrir script…", hint: "Ctrl+O", onSelect: () => files.openFile(tabs.active ?? newTabTarget()) },
    {
      label: "Guardar script",
      hint: "Ctrl+S",
      disabled: !tabs.active,
      onSelect: () => tabs.active && files.save(tabs.active),
    },
    { label: "Backup…", disabled: !session, onSelect: () => runOnTarget("backupDatabase") },
    { label: "Restaurar backup…", disabled: !session, onSelect: () => runOnTarget("restoreDatabase") },
    { label: "Sincronizar con otro entorno…", disabled: !session, onSelect: () => runOnTarget("syncDatabase") },
    { label: layout.logsOpen ? "Ocultar logs" : "Mostrar logs", onSelect: layout.toggleLogs },
    { label: "Acerca de Robo3B", onSelect: () => setAboutOpen(true) },
  ];

  return (
    <>
      <Toolbar
        handlers={handlers}
        pressed={{
          toggleSidebar: !layout.sidebarHidden,
          logs: layout.logsOpen,
          safeMode: !!session?.safeMode,
          operations: operations.panelOpen,
        }}
        disabled={{ databases: !selectedSession, openMongosh: !target || !!session?.safeMode, quickActions: !target, safeMode: !session }}
        disabledReasons={{ databases: NO_CONNECTION_SELECTED }}
        menuItems={menuItems}
        badges={{ operations: operationsBadge(operations.operations) }}
        status={status}
      />
      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
      {quickOpen.mode && (
        <QuickOpen key={quickOpen.mode} mode={quickOpen.mode} context={quickOpen.context} items={quickOpen.items} onPick={quickOpen.pick} onClose={quickOpen.close} />
      )}
    </>
  );
}
