// Wires the workspace toolbar to the explorer, the shell tabs and the open sessions.
import { useState } from "react";
import type { ContextMenuItem } from "../shared/ui/ContextMenu";
import { displayName, type MongoConnection } from "../features/connections/domain/connection";
import type { Session } from "../features/connections/domain/session";
import { serverNode } from "../features/explorer/domain/tree";
import type { WorkspaceControls } from "../features/explorer/ui/Workspace";
import type { NewTab } from "../features/shell/domain/tabs";
import type { ScriptFileActions } from "../features/shell/ui/useScriptFileActions";
import type { ShellTabs } from "../features/shell/ui/useShellTabs";
import type { StatusContext } from "../features/workspace/domain/statusLabel";
import { AboutDialog } from "../features/workspace/ui/AboutDialog";
import type { OpenDatabaseResult } from "../features/workspace/ui/OpenDatabaseDialog";
import { QuickOpen } from "../features/workspace/ui/QuickOpen";
import { Toolbar } from "../features/workspace/ui/Toolbar";
import type { PanelLayout } from "../features/workspace/ui/usePanelLayout";
import { useToolbarShortcuts, type ToolbarHandlers } from "../features/workspace/ui/useToolbarShortcuts";
import { confirmInWindow } from "../shared/ui/confirmInWindow";
import { openModalWindow } from "../shared/ui/modalWindow";
import { useLog } from "../shared/ui/useLog";
import { OPEN_DATABASE_VIEW } from "./ModalWindow";
import { useCurrentTarget } from "./useCurrentTarget";
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
  const quickOpen = useQuickOpen({ controls, sessions, connections, layout, target, onConnect });

  const databaseNodes = target ? controls.databases(target.sid) : [];
  const databases = databaseNodes.map((n) => ({ key: n.key, name: n.label, current: n.db === target?.db }));
  const pickDatabase = (key: string) => {
    const node = databaseNodes.find((n) => n.key === key);
    if (!node) return;
    layout.showSidebar();
    controls.reveal(node);
  };
  const targetDatabase = databaseNodes.find((n) => n.db === target?.db);
  const newDatabase = () =>
    session && controls.runAction("createDatabase", serverNode(session.conn.id, displayName(session.conn)));
  const showDatabases = async () => {
    let result: OpenDatabaseResult | null;
    try {
      result = await openModalWindow<OpenDatabaseResult>(OPEN_DATABASE_VIEW, databases, {
        title: "Abrir base de datos",
        width: 440,
        height: 520,
      });
    } catch (e) {
      log.error("No se pudo abrir la lista de bases de datos", e);
      return;
    }
    if (result?.kind === "open") pickDatabase(result.key);
    else if (result?.kind === "new") newDatabase();
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

  const handlers: ToolbarHandlers = {
    toggleSidebar: layout.toggleSidebar,
    connections: onShowConnections,
    databases: () => target && showDatabases(),
    openMongosh: () => target && controls.openMongosh(target.sid, target.db),
    openConnection: () => quickOpen.open("connection"),
    openDatabase: () => quickOpen.open("database"),
    quickActions: () => target?.db && quickOpen.open("action"),
    refresh: controls.refreshAll,
    safeMode: toggleSafeMode,
    logs: layout.toggleLogs,
  };
  useToolbarShortcuts(handlers);

  const menuItems: ContextMenuItem[] = [
    { label: "Nueva conexión…", onSelect: onNewConnection },
    { label: "Abrir script…", hint: "Ctrl+O", onSelect: () => files.openFile(tabs.active ?? newTabTarget()) },
    {
      label: "Guardar script",
      hint: "Ctrl+S",
      disabled: !tabs.active,
      onSelect: () => tabs.active && files.save(tabs.active),
    },
    {
      label: "Backup de base de datos…",
      disabled: !targetDatabase,
      onSelect: () => targetDatabase && controls.runAction("backupDatabase", targetDatabase),
    },
    {
      label: "Restaurar base de datos…",
      disabled: !targetDatabase,
      onSelect: () => targetDatabase && controls.runAction("restoreDatabase", targetDatabase),
    },
    { label: layout.logsOpen ? "Ocultar logs" : "Mostrar logs", onSelect: layout.toggleLogs },
    { label: "Acerca de Robo3B", onSelect: () => setAboutOpen(true) },
  ];

  return (
    <>
      <Toolbar
        handlers={handlers}
        pressed={{ toggleSidebar: !layout.sidebarHidden, logs: layout.logsOpen, safeMode: !!session?.safeMode }}
        disabled={{ databases: !target, openMongosh: !target || !!session?.safeMode, quickActions: !target?.db, safeMode: !session }}
        menuItems={menuItems}
        status={status}
      />
      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
      {quickOpen.mode && (
        <QuickOpen key={quickOpen.mode} mode={quickOpen.mode} context={quickOpen.context} items={quickOpen.items} onPick={quickOpen.pick} onClose={quickOpen.close} />
      )}
    </>
  );
}
