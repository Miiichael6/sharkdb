// Wires the workspace toolbar to the explorer, the shell tabs and the open sessions.
import { useState } from "react";
import type { ContextMenuItem } from "../shared/ui/ContextMenu";
import { displayName } from "../features/connections/domain/connection";
import type { Session } from "../features/connections/domain/session";
import type { WorkspaceControls } from "../features/explorer/ui/Workspace";
import type { NewTab } from "../features/shell/domain/tabs";
import type { ScriptFileActions } from "../features/shell/ui/useScriptFileActions";
import type { ShellTabs } from "../features/shell/ui/useShellTabs";
import type { StatusContext } from "../features/workspace/domain/statusLabel";
import { AboutDialog } from "../features/workspace/ui/AboutDialog";
import { Toolbar } from "../features/workspace/ui/Toolbar";
import type { PanelLayout } from "../features/workspace/ui/usePanelLayout";
import { useToolbarShortcuts, type ToolbarHandlers } from "../features/workspace/ui/useToolbarShortcuts";

interface Props {
  controls: WorkspaceControls;
  sessions: Session[];
  tabs: ShellTabs;
  files: ScriptFileActions;
  layout: PanelLayout;
  /** Where a new tab (or an opened script) goes when no shell tab is active. */
  newTabTarget: () => NewTab | null;
  onNewConnection: () => void;
  onShowConnections: () => void;
}

export function WorkspaceToolbar({ controls, sessions, tabs, files, layout, newTabTarget, onNewConnection, onShowConnections }: Props) {
  const [aboutOpen, setAboutOpen] = useState(false);

  // The active shell tab, or else the tree's selection, is "where the user is".
  const target = tabs.active ?? controls.selected;
  const session = target && sessions.find((s) => s.conn.id === target.sid);
  const status: StatusContext | null = session
    ? {
        tag: session.conn.tag,
        version: session.info.version,
        connection: displayName(session.conn),
        db: target.db,
        coll: target.coll,
      }
    : null;

  const databaseNodes = target ? controls.databases(target.sid) : [];
  const databases = databaseNodes.map((n) => ({ key: n.key, name: n.label, current: n.db === target?.db }));
  const pickDatabase = (key: string) => {
    const node = databaseNodes.find((n) => n.key === key);
    if (!node) return;
    layout.showSidebar();
    controls.reveal(node);
  };

  const handlers: ToolbarHandlers = {
    toggleSidebar: layout.toggleSidebar,
    connections: onShowConnections,
    openMongosh: () => target && controls.openMongosh(target.sid, target.db),
    refresh: controls.refreshAll,
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
    { label: layout.logsOpen ? "Ocultar logs" : "Mostrar logs", onSelect: layout.toggleLogs },
    { label: "Acerca de Robo3B", onSelect: () => setAboutOpen(true) },
  ];

  return (
    <>
      <Toolbar
        handlers={handlers}
        pressed={{ toggleSidebar: !layout.sidebarHidden, logs: layout.logsOpen }}
        disabled={{ databases: !target, openMongosh: !target }}
        menuItems={menuItems}
        databases={databases}
        onPickDatabase={pickDatabase}
        status={status}
      />
      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
    </>
  );
}
