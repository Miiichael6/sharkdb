// Wires the quick open palette to the saved connections, the open sessions and the explorer.
import { useState } from "react";
import { displayName, type MongoConnection } from "../features/connections/domain/connection";
import type { Session } from "../features/connections/domain/session";
import { serverNode, type TreeNode } from "../features/explorer/domain/tree";
import type { Action } from "../features/explorer/ui/Explorer";
import type { WorkspaceControls } from "../features/explorer/ui/Workspace";
import {
  actionItems,
  connectionItems,
  type QuickActionId,
  type QuickItem,
  type QuickOpenMode,
} from "../features/workspace/domain/quickOpen";
import type { PanelLayout } from "../features/workspace/ui/usePanelLayout";

/** The tree action each quick action runs. */
const TREE_ACTIONS: Record<QuickActionId, Action> = {
  sync: "syncDatabase",
  backup: "backupDatabase",
  restore: "restoreDatabase",
};

interface Options {
  controls: WorkspaceControls;
  sessions: Session[];
  connections: MongoConnection[];
  layout: PanelLayout;
  /** Where the user is: the active shell tab or the tree's selection. */
  target: { sid: string; db?: string } | null | undefined;
  onConnect: (conn: MongoConnection) => void;
}

export interface QuickOpenState {
  mode: QuickOpenMode | null;
  items: QuickItem[];
  /** The database the actions run on, shown in the palette. */
  context?: string;
  open: (mode: QuickOpenMode) => void;
  close: () => void;
  pick: (id: string) => void;
}

export function useQuickOpen({ controls, sessions, connections, layout, target, onConnect }: Options): QuickOpenState {
  const [mode, setMode] = useState<QuickOpenMode | null>(null);

  const session = target && sessions.find((s) => s.conn.id === target.sid);
  // Only while the palette is open: the toolbar renders far more often than the palette is used.
  const targetNode =
    mode && target?.db ? controls.databases(target.sid).find((n) => n.db === target.db) : undefined;

  const show = (node: TreeNode) => {
    layout.showSidebar();
    controls.reveal(node);
  };

  const items = (): QuickItem[] => {
    switch (mode) {
      case "connection":
        return connectionItems(
          connections.map((c) => ({ id: c.id, name: displayName(c), open: sessions.some((s) => s.conn.id === c.id) })),
        );
      case "action":
        return actionItems(!!session);
      default:
        return [];
    }
  };

  const pickConnection = (id: string) => {
    const conn = connections.find((c) => c.id === id);
    if (!conn) return;
    if (sessions.some((s) => s.conn.id === id)) show(serverNode(id, displayName(conn)));
    else onConnect(conn);
  };

  const pickAction = (id: string) => {
    const action = TREE_ACTIONS[id as QuickActionId];
    // Each action chooses its databases in its own window: the connection is enough.
    const node = targetNode ?? (session && serverNode(session.conn.id, displayName(session.conn)));
    if (!action || !node) return;
    if (node === targetNode) show(node);
    controls.runAction(action, node);
  };

  const pick = (id: string) => {
    if (mode === "connection") pickConnection(id);
    else if (mode === "action") pickAction(id);
  };

  const open = (next: QuickOpenMode) => setMode(next);

  const context =
    targetNode && session ? `${targetNode.db} · ${displayName(session.conn)}` : session ? displayName(session.conn) : undefined;
  return { mode, items: items(), context: mode === "action" ? context : undefined, open, close: () => setMode(null), pick };
}
